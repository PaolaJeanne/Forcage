// src/hooks/useDashboardBackend.js
import { useState, useEffect, useCallback, useRef } from 'react';
import apiService from '../services/api';

export const useDashboardBackend = (initialFilters = {}) => {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: null,
    dashboardData: null,
    demandes: [],
    filters: initialFilters
  });

  const isMountedRef = useRef(true);

  // Chargement des données
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isMountedRef.current) return;

    try {
      setState(prev => ({
        ...prev,
        loading: !isRefresh,
        refreshing: isRefresh,
        error: null
      }));

      // Appel direct au backend
      const dashboardResponse = await apiService.getDashboard(state.filters);
      
      if (!isMountedRef.current) return;

      if (dashboardResponse.success && dashboardResponse.data) {
        // Charger les demandes séparément
        const demandesResponse = await apiService.getDemandes({
          ...state.filters,
          page: 1,
          limit: 5
        });

        setState(prev => ({
          ...prev,
          dashboardData: dashboardResponse.data,
          demandes: demandesResponse.success ? demandesResponse.data.demandes || [] : [],
          loading: false,
          refreshing: false
        }));
      } else {
        throw new Error(dashboardResponse.message || 'Erreur de chargement');
      }

    } catch (error) {
      if (!isMountedRef.current) return;

      setState(prev => ({
        ...prev,
        error: error.message,
        dashboardData: apiService.getFallbackDashboardData(),
        loading: false,
        refreshing: false
      }));
    }
  }, [state.filters]);

  // Initialisation
  useEffect(() => {
    isMountedRef.current = true;
    loadData(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  // Rafraîchissement
  const refresh = useCallback(() => {
    loadData(true);
  }, [loadData]);

  // Mise à jour des filtres
  const updateFilters = useCallback((newFilters) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters }
    }));
  }, []);

  return {
    ...state,
    refresh,
    updateFilters,
    isLoading: state.loading || state.refreshing,
    hasData: !!state.dashboardData
  };
};