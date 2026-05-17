import HwpVoiceApp from "./hwpvoice-app";

export default function LandingPage() {
  if (process.env.NEXT_PUBLIC_APP_ONLY === "true") {
    return <HwpVoiceApp mode="workspaceOnly" />;
  }

  return <HwpVoiceApp mode="landing" />;
}
