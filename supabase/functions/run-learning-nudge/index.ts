import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * 학습독려 자동 발송.
 * 규칙(learning_nudge_rules) 조건에 해당하는 수강생을 추출해
 * 알림(notifications)을 생성하고 message_logs에 기록한다.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const ruleId: string | undefined = body?.rule_id;

    let query = supabase.from('learning_nudge_rules').select('*').eq('is_active', true);
    if (ruleId) query = supabase.from('learning_nudge_rules').select('*').eq('id', ruleId);
    const { data: rules, error: rErr } = await query;
    if (rErr) return json({ error: rErr.message }, 500);
    if (!rules?.length) return json({ sent: 0, message: '실행할 규칙이 없습니다.' });

    let sent = 0;

    for (const rule of rules) {
      // 대상 수강생 추출
      let enrollQuery = supabase
        .from('enrollments')
        .select('user_id, course_id, progress, updated_at')
        .eq('status', 'approved');
      if (rule.course_id) enrollQuery = enrollQuery.eq('course_id', rule.course_id);
      const { data: enrollments } = await enrollQuery;

      const threshold = Number(rule.threshold ?? 0);
      const now = Date.now();
      const targets = (enrollments ?? []).filter((e: any) => {
        if (rule.condition_type === 'progress_below') return Number(e.progress ?? 0) < threshold;
        if (rule.condition_type === 'inactive_days') {
          const last = e.updated_at ? new Date(e.updated_at).getTime() : 0;
          return (now - last) / 86400000 >= threshold;
        }
        return Number(e.progress ?? 0) < 100;
      });
      if (targets.length === 0) continue;

      // 템플릿 본문
      let subject = '학습 독려 안내';
      let bodyText = '수강 중인 과정의 학습을 이어가 주세요.';
      if (rule.template_id) {
        const { data: tpl } = await supabase
          .from('message_templates').select('subject, body').eq('id', rule.template_id).maybeSingle();
        if (tpl) {
          subject = tpl.subject || subject;
          bodyText = tpl.body || bodyText;
        }
      }

      const notifications = targets.map((t: any) => ({
        user_id: t.user_id,
        title: subject,
        message: bodyText.replace(/\{\{\s*progress\s*\}\}/g, String(Math.round(Number(t.progress ?? 0)))),
        type: 'info',
      }));

      const logs = targets.map((t: any) => ({
        template_id: rule.template_id,
        channel: rule.channel,
        recipient_user_id: t.user_id,
        subject,
        body: bodyText,
        status: 'sent',
        source: 'nudge',
      }));

      const CHUNK = 500;
      for (let i = 0; i < notifications.length; i += CHUNK) {
        const { error } = await supabase.from('notifications').insert(notifications.slice(i, i + CHUNK));
        if (error) console.error('notification insert failed:', error.message);
      }
      for (let i = 0; i < logs.length; i += CHUNK) {
        const { error } = await supabase.from('message_logs').insert(logs.slice(i, i + CHUNK));
        if (error) console.error('message_logs insert failed:', error.message);
      }

      await supabase
        .from('learning_nudge_rules')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', rule.id);

      sent += targets.length;
    }

    return json({ sent });
  } catch (e) {
    console.error('run-learning-nudge failed:', e);
    return json({ error: (e as Error).message }, 500);
  }
});
