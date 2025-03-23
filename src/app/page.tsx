import { redirect } from "next/navigation";

// Redirect the user to the default locale when `/` is requested
export default function RootPage() {
  redirect("/en");
}
