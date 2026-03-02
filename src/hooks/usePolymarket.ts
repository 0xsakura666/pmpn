"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { polymarketClient, type ApiCredentials, type Position, type OpenOrder } from "@/lib/polymarket-client";
import { createAndPostOrder, type CreateOrderParams } from "@/lib/polymarket-order";

export function usePolymarket() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [credentials, setCredentials] = useState<ApiCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletClient && address) {
      polymarketClient.setWalletClient(walletClient, address);
      const hasExisting = polymarketClient.hasCredentials();
      setIsAuthenticated(hasExisting);
      setCredentials(polymarketClient.getCredentials());
    } else {
      polymarketClient.clearWalletClient();
      setIsAuthenticated(false);
      setCredentials(null);
    }
  }, [walletClient, address]);

  const authenticate = useCallback(async () => {
    if (!walletClient || !address) {
      setError("Wallet not connected");
      return false;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const creds = await polymarketClient.deriveApiCredentials();
      setCredentials(creds);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [walletClient, address]);

  const logout = useCallback(() => {
    if (address) {
      localStorage.removeItem(`polymarket_creds_${address}`);
    }
    polymarketClient.clearWalletClient();
    setIsAuthenticated(false);
    setCredentials(null);
  }, [address]);

  return {
    isConnected,
    isAuthenticated,
    isAuthenticating,
    credentials,
    error,
    address,
    authenticate,
    logout,
  };
}

export function usePolymarketPositions() {
  const { address, isConnected } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await polymarketClient.getPositions(address);
      setPositions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch positions");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchPositions();
    } else {
      setPositions([]);
    }
  }, [isConnected, address, fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    refetch: fetchPositions,
  };
}

export function usePolymarketOrders() {
  const { isAuthenticated } = usePolymarket();
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await polymarketClient.getOpenOrders();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [isAuthenticated, fetchOrders]);

  const cancelOrder = useCallback(async (orderId: string) => {
    try {
      await polymarketClient.cancelOrder(orderId);
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
      return false;
    }
  }, [fetchOrders]);

  const cancelAllOrders = useCallback(async () => {
    try {
      await polymarketClient.cancelAllOrders();
      await fetchOrders();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel orders");
      return false;
    }
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
    cancelOrder,
    cancelAllOrders,
  };
}

export function usePolymarketTrade() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isAuthenticated, credentials } = usePolymarket();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeOrder = useCallback(
    async (params: CreateOrderParams & { funderAddress?: string }) => {
      if (!walletClient || !address || !credentials) {
        setError("Not authenticated");
        return { success: false, errorMsg: "Not authenticated" };
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const funder = params.funderAddress || address;
        const result = await createAndPostOrder(
          walletClient,
          address,
          funder as `0x${string}`,
          credentials,
          params
        );

        if (!result.success) {
          setError(result.errorMsg || "Order failed");
        }

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Order failed";
        setError(errorMsg);
        return { success: false, errorMsg };
      } finally {
        setIsSubmitting(false);
      }
    },
    [walletClient, address, credentials]
  );

  return {
    placeOrder,
    isSubmitting,
    error,
    isReady: isAuthenticated && !!walletClient && !!credentials,
  };
}
