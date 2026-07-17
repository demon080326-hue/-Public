import { redirect } from "next/navigation";

export default function MemberRedirectPage() {
  redirect("/login");
}
