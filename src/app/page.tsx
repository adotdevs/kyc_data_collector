import type { Metadata } from "next";
import { INDEX_HEAD_STYLES, INDEX_BODY_HTML } from "@/lib/landingPagesData";
import HomepageClientInteractions from "@/components/HomepageClientInteractions";

export const metadata: Metadata = {
  title: "GOin SAS — Crypto investing, held securely",
  description:
    "Institutional safekeeping, execution, digital asset recovery, and discretionary portfolio management.",
};

export default function HomePage() {
  return (
    <>
      <div
        dangerouslySetInnerHTML={{
          __html: INDEX_HEAD_STYLES,
        }}
      />
      <div
        id="goin-homepage-root"
        dangerouslySetInnerHTML={{
          __html: INDEX_BODY_HTML,
        }}
      />
      <HomepageClientInteractions />
    </>
  );
}
