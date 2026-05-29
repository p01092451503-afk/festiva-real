import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DemoPreset {
  id: string;
  name: string;
  industry: string;
  logo_url: string | null;
  login_bg_image_url: string | null;
  brand_name: string | null;
  brand_tagline: string | null;
  is_active: boolean;
  login_top_text: string | null;
  login_subtitle: string | null;
  login_form_logo_url: string | null;
  login_form_brand_name: string | null;
  sidebar_brand_name: string | null;
  sidebar_logo_url: string | null;
  accent_hsl: string | null;
}

interface PresetCourseOverride {
  course_id: string;
  override_title: string | null;
  override_thumbnail_url: string | null;
  sort_order: number;
}

interface DemoPresetContextType {
  activePreset: DemoPreset | null;
  courseOverrides: Map<string, PresetCourseOverride>;
  getCourseTitle: (courseId: string, originalTitle: string) => string;
  getCourseThumbnail: (courseId: string, originalUrl: string | null) => string | null;
  isLoading: boolean;
}

const DemoPresetContext = createContext<DemoPresetContextType>({
  activePreset: null,
  courseOverrides: new Map(),
  getCourseTitle: (_, t) => t,
  getCourseThumbnail: (_, u) => u,
  isLoading: false,
});

export const useDemoPreset = () => useContext(DemoPresetContext);

export const DemoPresetProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: activePreset = null, isLoading: presetLoading } = useQuery({
    queryKey: ["demo-preset-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_presets")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as DemoPreset | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: overridesList = [], isLoading: overridesLoading } = useQuery({
    queryKey: ["demo-preset-courses", activePreset?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_preset_courses")
        .select("course_id, override_title, override_thumbnail_url, sort_order")
        .eq("preset_id", activePreset!.id)
        .order("sort_order");
      if (error) throw error;
      return data as PresetCourseOverride[];
    },
    enabled: !!activePreset?.id,
    staleTime: 5 * 60 * 1000,
  });

  const courseOverrides = useMemo(
    () => new Map(overridesList.map((o) => [o.course_id, o])),
    [overridesList]
  );

  const getCourseTitle = (courseId: string, originalTitle: string) => {
    const override = courseOverrides.get(courseId);
    return override?.override_title || originalTitle;
  };

  const getCourseThumbnail = (courseId: string, originalUrl: string | null) => {
    const override = courseOverrides.get(courseId);
    return override?.override_thumbnail_url || originalUrl;
  };

  return (
    <DemoPresetContext.Provider
      value={{
        activePreset,
        courseOverrides,
        getCourseTitle,
        getCourseThumbnail,
        isLoading: presetLoading || overridesLoading,
      }}
    >
      {children}
    </DemoPresetContext.Provider>
  );
};
