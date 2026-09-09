/**
 * Posts API Service
 * Functions for consuming social module endpoints
 * All endpoints require Bearer accessToken (handled by axiosInstance)
 */

import axiosInstance from '../utils/axiosInstance';
import { normalizePostsPayload } from '../utils/authorDisplay';
import { getUploadSizeError } from '../utils/uploadLimits';
import { extractMentionedUserIds } from '../utils/postBodyFormat';

const POSTS_API_URL = '/api/posts';

// ============================================
// MEDIA UPLOAD
// ============================================

/**
 * Upload media (image or video) for posts via multipart.
 * @param {File} file - The file to upload
 * @returns {Object} - { url, kind, thumbnailUrl }
 */
export const uploadMedia = async (file) => {
  try {
    const sizeError = getUploadSizeError(file);
    if (sizeError) {
      const err = new Error(sizeError);
      err.response = { data: { error: sizeError, message: sizeError } };
      throw err;
    }

    const formData = new FormData();
    formData.append("media", file);

    const response = await axiosInstance.post(
      `${POSTS_API_URL}/upload-media`,
      formData,
    );
    const data = response.data || {};
    const first = Array.isArray(data.media) ? data.media[0] : null;
    return {
      url: data.url || first?.url,
      kind: data.kind || first?.kind || (file.type.startsWith("video/") ? "video" : "image"),
      thumbnailUrl: data.thumbnailUrl ?? first?.thumbnailUrl ?? null,
    };
  } catch (error) {
    console.error("Error uploading media:", error.response?.data || error.message);
    throw error;
  }
};

// ============================================
// FEED ENDPOINTS
// ============================================

/**
 * Get feed posts
 * @param {number} limit - Number of posts to fetch (default 20, max 50)
 * @param {string} cursor - Cursor for pagination
 */
export const getFeed = async (limit = 20, cursor = null, options = {}) => {
  try {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    if (options.hashtag) params.hashtag = options.hashtag;
    const response = await axiosInstance.get(`${POSTS_API_URL}/feed`, { params });
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching feed:', error);
    throw error;
  }
};

export const searchMentionSuggestions = async (query, limit = 12, options = {}) => {
  const q = String(query || "").trim().replace(/^@/, "");
  if (options.exact && !q) return [];
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/mention-suggestions`, {
      params: { q, limit, exact: options.exact ? "1" : undefined },
      signal: options.signal,
    });
    return Array.isArray(response.data?.users) ? response.data.users : [];
  } catch (error) {
    if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return [];
    console.error("Error searching mention suggestions:", error);
    return [];
  }
};

/**
 * Get user's drafts and scheduled posts
 */
export const getDrafts = async () => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/drafts`);
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    throw error;
  }
};

/**
 * Get user's saved posts
 * @param {number} limit - Number of posts to fetch
 * @param {string} cursor - Cursor for pagination
 */
export const getSavedPosts = async (limit = 20, cursor = null, options = {}) => {
  try {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    if (options.hashtag) params.hashtag = options.hashtag;
    const response = await axiosInstance.get(`${POSTS_API_URL}/saved`, { params });
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    throw error;
  }
};

/**
 * Get user's timeline (posts by specific user)
 * @param {string} userId - User ID
 * @param {number} limit - Number of posts to fetch
 * @param {string|null} cursor - Cursor for pagination
 * @param {{ mediaType?: 'image'|'video'|null }} [options]
 */
export const getUserPosts = async (userId, limit = 20, cursor = null, options = {}) => {
  try {
    const params = { limit };
    if (cursor) params.cursor = cursor;
    if (options.mediaType) params.media_type = options.mediaType;
    const response = await axiosInstance.get(`${POSTS_API_URL}/user/${userId}`, { params });
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    throw error;
  }
};

// ============================================
// POST CRUD ENDPOINTS
// ============================================

/**
 * Create a new post
 * @param {Object} postData - Post data
 * @param {string} postData.body - Post content
 * @param {string} postData.visibility - 'public' or 'connections'
 * @param {string} postData.status - 'draft', 'scheduled', or 'published'
 * @param {string} postData.scheduledAt - ISO date string for scheduled posts
 * @param {string} postData.linkUrl - Optional link URL
 * @param {Array} postData.media - Optional array of media objects
 */
export const createPost = async (postData) => {
  try {
    const response = await axiosInstance.post(POSTS_API_URL, postData);
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

/**
 * Get a single post by ID
 * @param {string} postId - Post UUID
 */
export const getPost = async (postId) => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/${postId}`);
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching post:', error);
    throw error;
  }
};

/**
 * Get a post for shared links — works for public posts without login.
 * @param {string} postId - Post UUID
 */
export const getPublicPost = async (postId) => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/public/${postId}`);
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error fetching public post:', error);
    throw error;
  }
};

/**
 * Update a post
 * @param {string} postId - Post UUID
 * @param {Object} postData - Updated post data
 */
export const updatePost = async (postId, postData) => {
  try {
    const response = await axiosInstance.patch(`${POSTS_API_URL}/${postId}`, postData);
    return normalizePostsPayload(response.data);
  } catch (error) {
    console.error('Error updating post:', error);
    throw error;
  }
};

/**
 * Delete a post (soft delete)
 * @param {string} postId - Post UUID
 */
export const deletePost = async (postId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// ============================================
// LIKE ENDPOINTS
// ============================================

/**
 * Get likes for a post
 * @param {string} postId - Post UUID
 */
export const getPostLikes = async (postId) => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/${postId}/likes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching post likes:', error);
    throw error;
  }
};

/**
 * Like a post
 * @param {string} postId - Post UUID
 */
export const likePost = async (postId) => {
  try {
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/like`);
    return response.data;
  } catch (error) {
    console.error('Error liking post:', error);
    throw error;
  }
};

/**
 * Unlike a post
 * @param {string} postId - Post UUID
 */
export const unlikePost = async (postId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}/like`);
    return response.data;
  } catch (error) {
    console.error('Error unliking post:', error);
    throw error;
  }
};

// ============================================
// SHARE/REPOST ENDPOINTS
// ============================================

/**
 * Get shares for a post
 * @param {string} postId - Post UUID
 */
export const getPostShares = async (postId) => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/${postId}/shares`);
    return response.data;
  } catch (error) {
    console.error('Error fetching post shares:', error);
    throw error;
  }
};

/**
 * Share/repost a post
 * @param {string} postId - Post UUID
 * @param {string} quote - Optional quote for the share
 */
export const sharePost = async (postId, quote = null, scheduledAt = null) => {
  try {
    const body = { quote };
    if (scheduledAt) body.scheduledAt = scheduledAt;
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/share`, body);
    return response.data;
  } catch (error) {
    console.error('Error sharing post:', error);
    throw error;
  }
};

/**
 * Remove a share/repost
 * @param {string} postId - Post UUID
 */
export const unsharePost = async (postId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}/share`);
    return response.data;
  } catch (error) {
    console.error('Error removing share:', error);
    throw error;
  }
};

// ============================================
// SAVE ENDPOINTS
// ============================================

/**
 * Save a post
 * @param {string} postId - Post UUID
 */
export const savePost = async (postId) => {
  try {
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/save`);
    return response.data;
  } catch (error) {
    console.error('Error saving post:', error);
    throw error;
  }
};

/**
 * Unsave a post
 * @param {string} postId - Post UUID
 */
export const unsavePost = async (postId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}/save`);
    return response.data;
  } catch (error) {
    console.error('Error unsaving post:', error);
    throw error;
  }
};

// ============================================
// IMPRESSION ENDPOINTS
// ============================================

/**
 * Record post impression (deduped per user/post/UTC day).
 * Failures are swallowed so tracking never disrupts the feed.
 * @param {string} postId - Post UUID
 */
export const recordImpression = async (postId) => {
  try {
    const response = await axiosInstance.post(
      `${POSTS_API_URL}/${postId}/impression`,
    );
    return response.data;
  } catch {
    return { counted: false, error: true };
  }
};

export const voteOnPoll = async (postId, optionId) => {
  try {
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/poll/vote`, {
      optionId,
    });
    return response.data;
  } catch (error) {
    console.error('Error voting on poll:', error);
    throw error;
  }
};

// ============================================
// COMMENT ENDPOINTS
// ============================================

/**
 * Get comments for a post
 * @param {string} postId - Post UUID
 */
export const getComments = async (postId) => {
  try {
    const response = await axiosInstance.get(`${POSTS_API_URL}/${postId}/comments`);
    return response.data;
  } catch (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }
};

/**
 * Add a comment to a post
 * @param {string} postId - Post UUID
 * @param {string} body - Comment content
 * @param {string} parentCommentId - Optional parent comment ID for replies
 */
export const addComment = async (postId, body, parentCommentId = null) => {
  try {
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/comments`, {
      body,
      parentCommentId,
      mentionedUserIds: extractMentionedUserIds(body),
    });
    return response.data;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

/**
 * Update a comment
 * @param {string} postId - Post UUID
 * @param {string} commentId - Comment UUID
 * @param {string} body - Updated comment content
 */
export const updateComment = async (postId, commentId, body) => {
  try {
    const response = await axiosInstance.patch(`${POSTS_API_URL}/${postId}/comments/${commentId}`, {
      body,
      mentionedUserIds: extractMentionedUserIds(body),
    });
    return response.data;
  } catch (error) {
    console.error('Error updating comment:', error);
    throw error;
  }
};

/**
 * Delete a comment (soft delete)
 * @param {string} postId - Post UUID
 * @param {string} commentId - Comment UUID
 */
export const deleteComment = async (postId, commentId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}/comments/${commentId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
};

/**
 * Like a comment
 * @param {string} postId - Post UUID
 * @param {string} commentId - Comment UUID
 */
export const likeComment = async (postId, commentId) => {
  try {
    const response = await axiosInstance.post(`${POSTS_API_URL}/${postId}/comments/${commentId}/like`);
    return response.data;
  } catch (error) {
    console.error('Error liking comment:', error);
    throw error;
  }
};

/**
 * Unlike a comment
 * @param {string} postId - Post UUID
 * @param {string} commentId - Comment UUID
 */
export const unlikeComment = async (postId, commentId) => {
  try {
    const response = await axiosInstance.delete(`${POSTS_API_URL}/${postId}/comments/${commentId}/like`);
    return response.data;
  } catch (error) {
    console.error('Error unliking comment:', error);
    throw error;
  }
};

// ============================================
// CONNECTION ENDPOINTS
// ============================================

const CONNECTIONS_API_URL = '/api/connections';

/**
 * Get user's accepted connections
 */
export const getConnections = async () => {
  try {
    const response = await axiosInstance.get(CONNECTIONS_API_URL);
    return response.data;
  } catch (error) {
    console.error('Error fetching connections:', error);
    throw error;
  }
};

/**
 * Get connection status with another user
 * @param {number} otherUserId - User ID
 */
export const getConnectionStatus = async (otherUserId) => {
  try {
    const response = await axiosInstance.get(`${CONNECTIONS_API_URL}/status/${otherUserId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching connection status:', error);
    throw error;
  }
};

/**
 * Send a connection request
 * @param {number} toUserId - User ID to connect with
 */
export const sendConnectionRequest = async (toUserId) => {
  try {
    const response = await axiosInstance.post(`${CONNECTIONS_API_URL}/requests`, { toUserId });
    return response.data;
  } catch (error) {
    console.error('Error sending connection request:', error);
    throw error;
  }
};

/**
 * Get incoming connection requests
 */
export const getIncomingRequests = async () => {
  try {
    const response = await axiosInstance.get(`${CONNECTIONS_API_URL}/requests/incoming`);
    return response.data;
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    throw error;
  }
};

/**
 * Get outgoing connection requests
 */
export const getOutgoingRequests = async () => {
  try {
    const response = await axiosInstance.get(`${CONNECTIONS_API_URL}/requests/outgoing`);
    return response.data;
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    throw error;
  }
};

/**
 * Accept a connection request
 * @param {string} requestId - Request UUID
 */
export const acceptConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.post(`${CONNECTIONS_API_URL}/requests/${requestId}/accept`);
    return response.data;
  } catch (error) {
    console.error('Error accepting connection request:', error);
    throw error;
  }
};

/**
 * Reject a connection request
 * @param {string} requestId - Request UUID
 */
export const rejectConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.post(`${CONNECTIONS_API_URL}/requests/${requestId}/reject`);
    return response.data;
  } catch (error) {
    console.error('Error rejecting connection request:', error);
    throw error;
  }
};

/**
 * Cancel an outgoing connection request
 * @param {string} requestId - Request UUID
 */
export const cancelConnectionRequest = async (requestId) => {
  try {
    const response = await axiosInstance.delete(`${CONNECTIONS_API_URL}/requests/${requestId}`);
    return response.data;
  } catch (error) {
    console.error('Error canceling connection request:', error);
    throw error;
  }
};

/**
 * Remove a connection (unfriend)
 * @param {number} peerUserId - User ID
 */
export const removeConnection = async (peerUserId) => {
  try {
    const response = await axiosInstance.delete(`${CONNECTIONS_API_URL}/${peerUserId}`);
    return response.data;
  } catch (error) {
    console.error('Error removing connection:', error);
    throw error;
  }
};

// ============================================
// METRICS ENDPOINTS
// ============================================

const METRICS_API_URL = '/api/metrics';

/**
 * Get current user's metrics (aggregate + per-post).
 * @param {'all'|'week'|'month'} [period='all']
 * @param {{ postIds?: string[], limit?: number, offset?: number }} [options]
 */
export const getMyMetrics = async (period = "all", options = {}) => {
  try {
    const params = { period };
    if (Array.isArray(options.postIds) && options.postIds.length > 0) {
      params.postIds = options.postIds.join(",");
    }
    if (options.limit != null) params.limit = options.limit;
    if (options.offset != null) params.offset = options.offset;
    const response = await axiosInstance.get(`${METRICS_API_URL}/me`, {
      params,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching metrics:", error);
    throw error;
  }
};