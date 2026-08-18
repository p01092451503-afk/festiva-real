import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, Award, Loader2 } from "lucide-react";
import { PagePattern } from "@/components/PagePattern";
import { pageBg } from "@/config/pageBackgrounds";

type Verified = {
  recipient_name: string;
  source_title: string;
  source_type: string;
  issued_at: string;
  cert_number: string | null;
  is_revoked: boolean;
};

export default function VerifyCertificate() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Verified | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      const { data, error } = await supabase.rpc("verify_ops_certificate", { _code: code });
      if (!error && data && data.length > 0) {
        setData(data[0] as Verified);
      }
      setLoading(false);
    })();
  }, [code]);

  return (
    <div className={`relative min-h-screen ${pageBg("verify").gradient} flex flex-col items-center justify-center p-6 overflow-hidden`}>
      <PagePattern config={pageBg("verify")} />

      <div className="relative w-full max-w-md space-y-6">

        <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          ← 홈으로
        </Link>
        <Card>
          <CardContent className="p-8 space-y-4 text-center">
            <div className="flex justify-center">
              <Award className="w-10 h-10 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold">인증서 진위 확인</h1>
            <div className="text-xs text-muted-foreground font-mono">CODE: {code}</div>

            {loading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !data ? (
              <div className="py-6 space-y-2">
                <ShieldX className="w-10 h-10 mx-auto text-destructive" />
                <p className="font-medium text-destructive">유효하지 않은 인증서입니다</p>
                <p className="text-xs text-muted-foreground">코드를 다시 확인해주세요.</p>
              </div>
            ) : data.is_revoked ? (
              <div className="py-6 space-y-3 text-left">
                <div className="flex items-center gap-2">
                  <ShieldX className="w-5 h-5 text-destructive" />
                  <Badge variant="destructive">폐기됨</Badge>
                </div>
                <InfoRow label="수령자" value={data.recipient_name} />
                <InfoRow label="과정/프로그램" value={data.source_title} />
                <InfoRow label="발급일" value={new Date(data.issued_at).toLocaleDateString("ko-KR")} />
              </div>
            ) : (
              <div className="py-6 space-y-3 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <Badge>유효한 인증서</Badge>
                </div>
                <InfoRow label="수령자" value={data.recipient_name} />
                <InfoRow label="과정/프로그램" value={data.source_title} />
                <InfoRow label="종류" value={data.source_type === "program" ? "프로그램" : data.source_type === "project" ? "산학프로젝트" : "수동 발급"} />
                <InfoRow label="발급일" value={new Date(data.issued_at).toLocaleDateString("ko-KR")} />
                {data.cert_number && <InfoRow label="문서번호" value={data.cert_number} />}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b last:border-b-0 py-1.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}