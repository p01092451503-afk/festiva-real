import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";

interface Props {
  html: string;
  className?: string;
}

/** Renders sanitized rich text produced by RichTextEditor */
const RichTextContent = ({ html, className }: Props) => {
  const clean = DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "strike", "h1", "h2", "h3", "h4",
      "ul", "ol", "li", "blockquote", "a", "img", "div", "span", "code", "pre", "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class"],
  });

  return (
    <div
      className={cn("prose-editor text-sm leading-relaxed break-words", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default RichTextContent;
