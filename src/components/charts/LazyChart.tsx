"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";

const ChartLoading = () => (
  <div className="w-full h-full min-h-[200px] flex items-center justify-center">
    <Skeleton className="w-full h-full" />
  </div>
);

export const LazyPriceChart = dynamic(
  () => import("./PriceChart").then((mod) => mod.PriceChart),
  {
    loading: ChartLoading,
    ssr: false,
  }
);

export const LazyVolumeChart = dynamic(
  () => import("./VolumeChart").then((mod) => mod.VolumeChart),
  {
    loading: ChartLoading,
    ssr: false,
  }
);

export const LazyDistributionChart = dynamic(
  () => import("./DistributionChart").then((mod) => mod.DistributionChart),
  {
    loading: ChartLoading,
    ssr: false,
  }
);
