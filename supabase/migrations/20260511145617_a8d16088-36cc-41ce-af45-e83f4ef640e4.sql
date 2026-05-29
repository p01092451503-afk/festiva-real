DELETE FROM public.user_track_progress;
DELETE FROM public.learning_tracks;

DO $$
DECLARE
  t1 uuid := gen_random_uuid();
  t2 uuid := gen_random_uuid();
  t3 uuid := gen_random_uuid();
  s uuid;
  -- Course IDs
  c_rc  uuid := '57e37c43-67c6-47b5-a180-b95694150ec1';
  c_lc  uuid := '75aca6d7-14ac-4289-b7b1-e97b606a7575';
  c_md1 uuid := '75e9de5f-bf4f-49f7-a390-2757b1bd17ff';
  c_md2 uuid := '43fe0f54-635e-4e0a-b758-07b76ee598d5';
  c_ts1 uuid := 'b36f378d-16e2-4c57-b469-ec98230d84a6';
  c_ts2 uuid := '2c8ae9ef-e14d-4a74-8094-4602667c5d2c';
BEGIN
  -- Track 1: TOEIC
  INSERT INTO public.learning_tracks (id, name, name_en, description, description_en, sort_order, is_active, target_scope)
  VALUES (t1, 'TOEIC 마스터 과정', 'TOEIC Mastery Track',
          'RC와 LC를 단계별로 정복하는 TOEIC 종합 학습 과정', 'Step-by-step TOEIC RC & LC training', 1, true, 'all');

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t1, 'Foundation', 'Foundation', 'TOEIC RC 기초 문법과 독해 다지기', 1, '#3B82F6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_rc, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t1, 'Practice', 'Practice', 'TOEIC LC 실전 청취 훈련', 2, '#10B981');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_lc, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t1, 'Advanced', 'Advanced', 'RC와 LC를 통합한 실전 마무리', 3, '#8B5CF6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES
    (s, c_rc, 1, true), (s, c_lc, 2, true);

  -- Track 2: Medical English
  INSERT INTO public.learning_tracks (id, name, name_en, description, description_en, sort_order, is_active, target_scope)
  VALUES (t2, '메디컬 영어 트랙', 'Medical English Track',
          '병원·의료 현장에서 바로 쓰는 메디컬 영어 학습 트랙', 'Practical English for hospital and medical settings', 2, true, 'all');

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t2, 'Foundation', 'Foundation', '환자 응대 기본 회화', 1, '#3B82F6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_md1, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t2, 'Practice', 'Practice', '핵심 의학 용어와 표현 학습', 2, '#10B981');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_md2, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t2, 'Expert', 'Expert', '실전 임상 영어 종합 활용', 3, '#8B5CF6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES
    (s, c_md1, 1, true), (s, c_md2, 2, true);

  -- Track 3: TOEIC Speaking
  INSERT INTO public.learning_tracks (id, name, name_en, description, description_en, sort_order, is_active, target_scope)
  VALUES (t3, '토익스피킹 완성 트랙', 'TOEIC Speaking Track',
          '파트별 전략으로 토익스피킹 점수를 끌어올리는 트랙', 'Boost your TOEIC Speaking with part-by-part strategies', 3, true, 'all');

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t3, 'Foundation', 'Foundation', 'Q1-2 사진묘사 마스터', 1, '#3B82F6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_ts1, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t3, 'Practice', 'Practice', 'Q11 의견말하기 집중 훈련', 2, '#10B981');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES (s, c_ts2, 1, true);

  s := gen_random_uuid();
  INSERT INTO public.track_steps (id, track_id, name, name_en, description, level_order, badge_color)
  VALUES (s, t3, 'Expert', 'Expert', '전 파트 통합 실전 훈련', 3, '#8B5CF6');
  INSERT INTO public.track_step_courses (step_id, course_id, sort_order, is_required) VALUES
    (s, c_ts1, 1, true), (s, c_ts2, 2, true);
END $$;
