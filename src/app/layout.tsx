import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Tectonic | Polymarket 专业交易终端",
  description:
    "专业预测市场交易终端，提供实时K线图表、聪明钱追踪和一键跟单功能。",
  keywords: [
    "polymarket",
    "预测市场", 
    "交易",
    "加密货币",
    "巨鲸追踪",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
