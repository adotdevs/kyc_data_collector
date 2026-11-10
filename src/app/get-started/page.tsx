import type { Metadata } from "next";
import {
  GET_STARTED_HEAD_STYLES,
  GET_STARTED_BODY_HTML,
} from "@/lib/landingPagesData";
import GetStartedClientInteractions from "@/components/GetStartedClientInteractions";

export const metadata: Metadata = {
  title: "Start Here | GOin SAS",
  description:
    "Complete your digital asset recovery and client onboarding agreement with GOin SAS.",
};

export default function GetStartedPage() {
  return (
    <>
      <div
        dangerouslySetInnerHTML={{
          __html: GET_STARTED_HEAD_STYLES,
        }}
      />
      <div
        id="goin-getstarted-root"
        dangerouslySetInnerHTML={{
          __html: GET_STARTED_BODY_HTML,
        }}
      />
      <GetStartedClientInteractions />
    </>
  );
}

