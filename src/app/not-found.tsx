import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Redirect the user to the default locale when `/` is requested
export default function RootNotFound() {
  redirect(`/${routing.defaultLocale}`);
}
