import { Fragment } from "react";

/** Renders text containing "Smart+Logix™" / "Smart+Rate™" with each name's
 *  "+" in the logo's ".drive" purple. The text reads the same as plain text. */
export function BrandText({ children }: { children: string }) {
  const parts = children.split(/(?<=Smart)\+(?=(?:Logix|Rate)™)/);
  // One inline element, so flex rows (with gaps) don't split the name apart.
  return (
    <span>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-gradient">+</span>}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
