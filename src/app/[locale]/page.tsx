import dynamic from "next/dynamic";
const ClientPage = dynamic(() => import("./client"), { ssr: false });
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "subtitle" });

  return {
    title: `${t("title")} - Tools by AI`,
    description: t("description"),
  };
}

export default function Page() {
  return <ClientPage />;
}
