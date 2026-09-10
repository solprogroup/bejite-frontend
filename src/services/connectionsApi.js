/**
 * Connections API Service
 * Dedicated service for all connection-related operations
 */

import axiosInstance from '../utils/axiosInstance';
import { filterAdminUsersFromSearch } from '../utils/filterAdminUsers';

/**
 * Get user's accepted connections
 */
export const getConnections = async (page = 1, limit = 10, q = '') => {
  try {
    const response = await axiosInstance.get('/api/connections', {
      params: {
        page,
        limit,
        ...(String(q || '').trim() ? { q: String(q).trim() } : {}),
      },
    });
    console.log('getConnections response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching connections:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
};

/**
 * Get mutual connections with another user
 */
export const getMutualConnections = async (otherUserId, page = 1, limit = 20) => {
  try {
    const response = await axiosInstance.get(
      `/api/connections/mutual/${encodeURIComponent(String(otherUserId))}`,
      {
        params: { page, limit },
      },
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching mutual connections:', error);
    throw error;
  }
};

/**
 * Get connection status with another user
 */
export const getConnectionStatus = async (otherUserId) => {
  try {
    const response = await axiosInstance.get(
      `/api/connections/status/${encodeURIComponent(String(otherUserId))}`,
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching connection status:', error);
    throw error;
  }
};

/**
 * Send connection request to another user
 */
export const sendConnectionRequest = async (toUserId) => {
  try {
    const response = await axiosInstance.post('/api/connections/requests', {
      toUserId: toUserId != null && toUserId !== '' ? String(toUserId) : toUserId,
    });
    return response.data;
  } catch (error) {
    console.error('Error sending connection request:', error);
    throw error;
  }
};

/**
 * Get incoming connection requests
 */
export const getIncomingRequests = async (page = 1, limit = 10) => {
  try {
    const response = await axiosInstance.get('/api/connections/requests/incoming', {
      params: { page, limit },
    });
    console.log('getIncomingRequests response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
};

/**
 * Get outgoing connection requests
 */
export const getOutgoingRequests = async (page = 1, limit = 10) => {
  try {
    const response = await axiosInstance.get('/api/connections/requests/outgoing', {
      params: { page, limit },
    });
    console.log('getOutgoingRequests response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
};

/**
 * Accept incoming connection request
 */
export const acceptConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/api/connections/requests/${requestId}/accept`);
    return response.data;
  } catch (error) {
    console.error('Error accepting connection request:', error);
    throw error;
  }
};

/**
 * Accept pending request from a specific user (profile Accept).
 */
export const acceptConnectionRequestFromUser = async (fromUserId) => {
  try {
    const response = await axiosInstance.post(
      `/api/connections/requests/from/${encodeURIComponent(String(fromUserId))}/accept`,
    );
    return response.data;
  } catch (error) {
    console.error('Error accepting connection request from user:', error);
    throw error;
  }
};

/**
 * Reject incoming connection request
 */
export const rejectConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.post(`/api/connections/requests/${requestId}/reject`);
    return response.data;
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    throw error;
  }
};

/**
 * Cancel outgoing connection request
 */
export const cancelConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.delete(`/api/connections/requests/${requestId}`);
    return response.data;
  } catch (error) {
    console.error('Error canceling connection request:', error);
    throw error;
  }
};

/**
 * Remove existing connection (unfriend)
 */
export const removeConnection = async (peerUserId) => {
  try {
    const response = await axiosInstance.delete(`/api/connections/${peerUserId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing connection:', error);
    throw error;
  }
};

/**
 * Discover users available for connection
 */
export const discoverUsers = async (limit = 20, offset = 0) => {
  try {
    const response = await axiosInstance.get('/api/connections/discover', {
      params: { limit, offset, _t: Date.now() }
    });
    console.log('discoverUsers response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error discovering users:', error);
    console.error('Error response:', error.response?.data);
    throw error;
  }
};

/**
 * Search for users to connect with
 * Note: This endpoint may need to be implemented in backend if not available
 */
export const searchUsers = async (query, limit = 20, offset = 0) => {
  try {
    const response = await axiosInstance.get('/api/connections/search', {
      params: { q: query, limit, offset }
    });
    if (response.data?.users) {
      return {
        ...response.data,
        users: filterAdminUsersFromSearch(response.data.users),
      };
    }
    return response.data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};