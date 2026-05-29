import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGuidedTour } from "@/hooks/useGuidedTour";

interface GuidedTourButtonProps {
  role: "student" | "teacher" | "admin";
}

const GuidedTourButton = ({ role }: GuidedTourButtonProps) => {
  const { startTour } = useGuidedTour(role);
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={startTour}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label={t("tour.startTour", "가이드 투어 시작")}
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t("tour.startTour", "가이드 투어")}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default GuidedTourButton;
