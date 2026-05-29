
-- Idempotent cleanup of previous AI feedback seed
DELETE FROM public.assignment_submissions
WHERE assignment_id IN (
  SELECT id FROM public.assignments WHERE title = '[AI 피드백 테스트] 학습 회고 과제'
);
DELETE FROM public.assignments WHERE title = '[AI 피드백 테스트] 학습 회고 과제';

-- Create one test assignment per course
INSERT INTO public.assignments (course_id, title, description, instructions, max_score, status, allow_late_submission, due_date)
SELECT
  c.id,
  '[AI 피드백 테스트] 학습 회고 과제',
  '본 강의에서 배운 내용을 본인의 언어로 정리하고, 실제 학습/업무에 어떻게 적용할 계획인지 작성해 주세요.',
  E'요구사항:\n1) 강의에서 다룬 핵심 개념 3가지를 본인의 말로 설명할 것 (각 2-3문장)\n2) 가장 인상 깊었던 부분과 그 이유를 서술할 것\n3) 앞으로 학습 또는 실무에 어떻게 적용할지 구체적인 실행 계획 2가지 이상 제시할 것\n\n평가 기준: 내용 충실도, 논리적 구조, 표현의 정확성, 실행 계획의 구체성',
  100,
  'published'::assignment_status,
  true,
  now() + interval '7 days'
FROM public.courses c;

-- Create submissions for every seed learner enrolled in each course
WITH seed AS (
  SELECT p.user_id, e.course_id, split_part(p.email, '@', 1) AS slug
  FROM public.profiles p
  JOIN public.enrollments e ON e.user_id = p.user_id
  WHERE p.email LIKE 'seed-learner-%@demo.local'
),
asg AS (
  SELECT id AS assignment_id, course_id FROM public.assignments WHERE title = '[AI 피드백 테스트] 학습 회고 과제'
)
INSERT INTO public.assignment_submissions (assignment_id, student_id, submission_text, status, submitted_at)
SELECT
  a.assignment_id,
  s.user_id,
  CASE (abs(hashtext(s.slug)) % 3)
    WHEN 0 THEN
      E'이번 강의를 들으면서 가장 인상 깊었던 부분은 핵심 표현을 반복적으로 익히는 과정이었습니다. 처음에는 단어와 문장 구조가 익숙하지 않아 어렵게 느껴졌지만, 강의에서 제시한 패턴을 따라 연습하니 점차 자연스럽게 발화할 수 있었습니다.\n\n첫째, 강의에서 강조한 핵심 개념은 "상황에 맞는 표현 선택"이었습니다. 단순히 단어를 외우는 것이 아니라, 어떤 맥락에서 어떤 표현을 써야 하는지 이해하는 것이 중요하다는 점을 배웠습니다. 둘째, 듣기와 말하기를 함께 훈련해야 한다는 점이 새로웠습니다. 셋째, 작은 단위로 나눠서 반복 학습하는 것의 효과를 직접 체감했습니다.\n\n앞으로의 실행 계획은 다음과 같습니다. 1) 매일 30분씩 강의 핵심 표현을 소리 내어 따라 읽고, 일주일 단위로 복습하겠습니다. 2) 동료와 함께 짧은 롤플레이를 진행하면서 실제 상황에서 자연스럽게 사용할 수 있도록 훈련하겠습니다.'
    WHEN 1 THEN
      E'강의 들음. 어려웠지만 재밌었음. 단어를 많이 외우려고 노력했음. 앞으로 더 열심히 공부하려고 함. 시간 날 때마다 복습하겠음.'
    ELSE
      E'이번 강의의 가장 큰 수확은 "패턴 인식"이라는 학습 전략을 체득한 것입니다. 강의에서는 반복적으로 등장하는 문장 구조를 시각적으로 정리해 보여주었는데, 이를 통해 단순 암기가 아닌 구조적 이해가 가능해졌습니다.\n\n핵심 개념 정리: (1) 표현은 맥락에 따라 달라진다 — 같은 단어라도 어조와 상황에 따라 의미가 변한다. (2) 청취 훈련이 발화의 토대다 — 들리지 않으면 말할 수 없다. (3) 짧고 자주 하는 학습이 길고 드문 학습보다 효과적이다.\n\n실행 계획: \n- 매일 아침 15분 강의 핵심 문장 섀도잉 (월~금)\n- 주 2회 학습 노트를 정리하여 블로그에 공유\n- 학습 동기를 유지하기 위해 한 달 단위로 작은 보상을 설정\n\n특히 인상 깊었던 점은, 강사가 "완벽함보다 꾸준함"이라고 강조한 부분이었습니다. 그동안 완벽하게 말하려다 입을 떼지 못했던 제 자신을 돌아보게 되었습니다.'
  END,
  'submitted'::submission_status,
  now() - (random() * interval '5 days')
FROM asg a
JOIN seed s ON s.course_id = a.course_id;
