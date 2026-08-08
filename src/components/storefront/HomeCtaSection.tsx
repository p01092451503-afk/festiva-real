import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Home block: sign-up call to action. */
const HomeCtaSection = ({
  title,
  subtitle,
  ctaText,
  ctaUrl,
}: {
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
}) => {
  const url = ctaUrl || "/auth";
  const external = /^https?:\/\//.test(url);
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{title || "지금 시작해 보세요"}</h2>
        <p className="text-sm opacity-90">{subtitle || "가입 후 바로 강의를 수강할 수 있습니다."}</p>
        <div className="pt-2">
          <Button asChild variant="secondary" size="lg">
            {external ? <a href={url}>{ctaText || "무료로 시작하기"}</a> : <Link to={url}>{ctaText || "무료로 시작하기"}</Link>}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HomeCtaSection;
