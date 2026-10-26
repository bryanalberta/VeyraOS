import * as React from "react";
import { AuthGatewayEvaluator } from "./auth-gateway-evaluator";
import { LandingPageView } from "./landing-page-view";

export interface HomeProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default function Home(props: HomeProps) {
  return (
    <>
      <React.Suspense fallback={null}>
        <AuthGatewayEvaluator searchParams={props?.searchParams} />
      </React.Suspense>
      <LandingPageView />
    </>
  );
}
