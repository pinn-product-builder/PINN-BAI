import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Organization, OrganizationInput } from '@/lib/types';

// Fetch all organizations (for platform admins)
export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

// Fetch a single organization by ID
export const useOrganization = (id: string | undefined) => {
  return useQuery({
    queryKey: ['organization', id],
    queryFn: async (): Promise<Organization | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

// Fetch organization by slug
export const useOrganizationBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['organization', 'slug', slug],
    queryFn: async (): Promise<Organization | null> => {
      if (!slug) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
};

// Create organization
export const useCreateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: OrganizationInput): Promise<Organization> => {
      const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const { data, error } = await supabase
        .from('organizations')
        .insert({
          name: input.name,
          slug,
          plan: input.plan,
          admin_name: input.admin_name,
          admin_email: input.admin_email,
          status: 'trial',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// Update organization
export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Organization> & { id: string }): Promise<Organization> => {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', data.id] });
    },
  });
};

// Delete organization
export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
};

// Get organization stats (leads count, users count, etc.)
export const useOrganizationStats = (orgId: string | undefined) => {
  return useQuery({
    queryKey: ['organization-stats', orgId],
    queryFn: async () => {
      if (!orgId) return null;

      // Get leads count
      const { count: leadsCount, error: leadsError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (leadsError) throw leadsError;

      // Get users count (profiles in this org)
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (usersError) throw usersError;

      // Get integrations count
      const { count: integrationsCount, error: integrationsError } = await supabase
        .from('integrations')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (integrationsError) throw integrationsError;

      return {
        totalLeads: leadsCount || 0,
        totalUsers: usersCount || 0,
        totalIntegrations: integrationsCount || 0,
      };
    },
    enabled: !!orgId,
  });
};
