import ClientPage from "./client";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subtitle" });

  return {
    title: `${t("title")} - Tools by AI`,
    description: t("description"),
    keywords: t("keywords"),
  };
}

export default function Page() {
  return <ClientPage />;
}
