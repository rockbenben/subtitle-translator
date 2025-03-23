"use client";

import { Result } from "antd";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

export default function NotFound() {
  const router = useRouter();
  const locale = useLocale();
  const homePath = `/${locale}`;
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(homePath);
    }, 3000);

    // 倒计时显示
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(countdownInterval);
    };
  }, [router, homePath]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Result status="404" title="404 - Page Not Found" subTitle={`Sorry, the page you visited does not exist. Redirecting to home page in ${countdown} seconds...`} />
    </div>
  );
}
