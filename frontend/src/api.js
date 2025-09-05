import axios from 'axios';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL } from './config';

// Debug log to check if configuration is loaded
console.log('Using configuration from config.js');
console.log('API Key:', TMDB_API_KEY ? 'Present' : 'Missing');
console.log('Base URL:', TMDB_BASE_URL);
console.log('Image Base URL:', TMDB_IMAGE_BASE_URL);

// Helper function to transform movie data
const transformMovieData = (movie) => {
  return {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    runtime: movie.runtime,
    genre: movie.genre_ids
      ? movie.genre_ids.map((id) => genreMap[id] || 'Unknown')
      : [],
    tagline: movie.tagline,
    backdrop_path: movie.backdrop_path,
    isInBookingWindow: movie.isInBookingWindow || false
  };
};

// Genre mapping
const genreMap = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western'
};

// Helper function to make API requests with better error handling
const makeApiRequest = async (endpoint, params = {}) => {
  try {
    if (!params.api_key) params.api_key = TMDB_API_KEY;
    if (!params.language) params.language = 'en-US';

    console.log(`Making API request to: ${TMDB_BASE_URL}/${endpoint}`);
    console.log('Request params:', { ...params, api_key: params.api_key ? 'Present' : 'Missing' });

    const response = await axios.get(`${TMDB_BASE_URL}/${endpoint}`, { params });
    console.log(`API Response from ${endpoint}:`, response.data);

    return response.data;
  } catch (error) {
    console.error(`Error in API request to ${endpoint}:`, error);

    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      if (error.response?.status === 401) {
        throw new Error('API key is invalid or expired. Please check your API key.');
      } else if (error.response?.status === 404) {
        throw new Error(`Endpoint ${endpoint} not found. Please check the API documentation.`);
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
    }

    throw error;
  }
};

// API functions
export const getMovies = async (language = 'en-US') => {
  try {
    console.log('Fetching popular movies...');
    const data = await makeApiRequest('movie/popular', { page: 1, language });
    return data.results.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error fetching movies:', error);
    return [];
  }
};

export const getNewReleases = async (language = 'en-US') => {
  try {
    console.log('Fetching newly released movies in theaters...');
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    const formatDate = (date) => date.toISOString().split('T')[0];

    const internationalMovies = await makeApiRequest('discover/movie', {
      'primary_release_date.gte': formatDate(oneMonthAgo),
      'primary_release_date.lte': formatDate(today),
      'vote_count.gte': 10,
      sort_by: 'release_date.desc',
      page: 1,
      region: 'US',
      language
    });

    const indianMovies = await makeApiRequest('discover/movie', {
      'primary_release_date.gte': formatDate(oneMonthAgo),
      'primary_release_date.lte': formatDate(today),
      'vote_count.gte': 10,
      sort_by: 'release_date.desc',
      page: 1,
      region: 'IN',
      language: 'hi-IN',
      with_original_language: 'hi'
    });

    const allMovies = [...(internationalMovies.results || []), ...(indianMovies.results || [])];
    const uniqueMovies = Array.from(new Map(allMovies.map((movie) => [movie.id, movie])).values());

    const sortedMovies = uniqueMovies.sort(
      (a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
    );

    return sortedMovies.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error fetching newly released movies:', error);
    return [];
  }
};

export const getTopRatedMovies = async (language = 'en-US') => {
  try {
    console.log('Fetching top rated movies...');
    const data = await makeApiRequest('movie/top_rated', {
      page: 1,
      region: 'US',
      language,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100
    });

    const topRatedMovies = data.results
      .filter((movie) => movie.vote_count >= 100)
      .sort((a, b) => b.vote_average - a.vote_average);

    return topRatedMovies.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error fetching top rated movies:', error);
    return [];
  }
};

export const getIndianMovies = async (language = 'en-US') => {
  try {
    console.log('Fetching Indian movies...');
    const today = new Date();
    const oneMonthAgo = new Date();
    const oneMonthLater = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    oneMonthLater.setMonth(today.getMonth() + 1);

    const newReleases = await makeApiRequest('movie/now_playing', {
      page: 1,
      region: 'IN',
      language,
      with_original_language: 'hi'
    });

    const upcomingMovies = await makeApiRequest('movie/upcoming', {
      page: 1,
      region: 'IN',
      language,
      with_original_language: 'hi'
    });

    const allMovies = [...(newReleases.results || []), ...(upcomingMovies.results || [])];
    const uniqueMovies = Array.from(new Map(allMovies.map((movie) => [movie.id, movie])).values());

    const indianMovies = uniqueMovies.filter((movie) => {
      const isIndian = ['hi', 'ta', 'te', 'ml', 'kn', 'bn'].includes(movie.original_language);
      if (isIndian) {
        const releaseDate = new Date(movie.release_date);
        movie.isInBookingWindow = releaseDate >= oneMonthAgo && releaseDate <= oneMonthLater;
      }
      return isIndian;
    });

    return indianMovies.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error fetching Indian movies:', error);
    return [];
  }
};

export const getUpcomingMovies = async (language = 'en-US') => {
  try {
    console.log('Fetching upcoming movies...');
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const data = await makeApiRequest('movie/upcoming', {
      page: 1,
      region: 'US',
      language,
      'primary_release_date.gte': formattedDate,
      sort_by: 'primary_release_date.asc'
    });

    const futureMovies = data.results.filter((movie) => {
      const releaseDate = new Date(movie.release_date);
      return releaseDate >= today;
    });

    return futureMovies.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return [];
  }
};

export const getMovieById = async (id) => {
  try {
    console.log(`Fetching movie with ID ${id}...`);
    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US' }
    });

    return transformMovieData(response.data);
  } catch (error) {
    console.error(`Error fetching movie with ID ${id}:`, error);
    return null;
  }
};

export const getMoviesByGenre = async (genre) => {
  try {
    const genresResponse = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
      params: { api_key: TMDB_API_KEY, language: 'en-US' }
    });

    const genreObj = genresResponse.data.genres.find(
      (g) => g.name.toLowerCase() === genre.toLowerCase()
    );
    if (!genreObj) return [];

    const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        with_genres: genreObj.id,
        sort_by: 'popularity.desc'
      }
    });

    return response.data.results.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error(`Error fetching movies by genre ${genre}:`, error);
    return [];
  }
};

export const searchMovies = async (query, language = 'en-US') => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query,
        language,
        include_adult: false
      }
    });

    if (!response.data.results || response.data.results.length === 0) {
      return [];
    }

    return response.data.results.map((movie) => transformMovieData(movie));
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
};

// Theater API calls
export const getTheaters = async () => {
  try {
    const response = await axios.get('https://cinemaconnect.onrender.com/api/theaters');
    return response.data;
  } catch (error) {
    console.error('Error fetching theaters:', error);
    throw error;
  }
};

export const getTheatersByCity = async (city) => {
  try {
    const response = await axios.get(`https://cinemaconnect.onrender.com/api/theaters/city/${city}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching theaters for city ${city}:`, error);
    throw error;
  }
};

export const getTheaterById = async (id) => {
  try {
    const response = await axios.get(`https://cinemaconnect.onrender.com/api/theaters/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching theater with id ${id}:`, error);
    throw error;
  }
};
