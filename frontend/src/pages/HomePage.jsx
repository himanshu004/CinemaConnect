import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';

const RENTAL_POLICY = "You can watch this movie unlimited times for 48 hours after payment. The rental is non-refundable.";
const RENTAL_PRICE = 199;

const HomePage = ({ searchQuery, activeSection }) => {
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalMovie, setRentalMovie] = useState(null);21212
  const [rentalError, setRentalError] = useState(null);
  const [rentalSuccess, setRentalSuccess] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);

  useEffect(() => {
    fetchMovies();
  }, [activeSection, searchQuery]);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      setError(null);
      let url = 'https://cinemaconnect-backend.onrender.com/api/movies';

      const params = new URLSearchParams();
      if (activeSection) params.append('section', activeSection);
      if (searchQuery) params.append('search', searchQuery);
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch movies');
      }

      const data = await response.json();
      setMovies(data);
    } catch (error) {
      setError(error.message || 'Failed to fetch movies');
    } finally {
      setLoading(false);
    }
  };

  const handleBookTicket = (movie) => {
    navigate('/booking', { state: { movie } });
  };

  const handleRentClick = (movie) => {
    setRentalMovie(movie);
    setShowRentalModal(true);
    setRentalError(null);
    setRentalSuccess(false);
  };

  const handleRentMovie = async () => {
    if (!rentalMovie) return;
    setRentalError(null);
    try {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      document.body.appendChild(script);
      await new Promise(resolve => { script.onload = resolve; });

      const response = await fetch('https://cinemaconnect-backend.onrender.com/api/payment/create-order', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ amount: RENTAL_PRICE * 100 })
      });
      const order = await response.json();

      const options = {
        key: 'rzp_test_pZ7rJCEC6C1nZd',
        amount: RENTAL_PRICE * 100,
        currency: 'INR',
        name: 'Cinema Connect',
        description: `Movie Rental: ${rentalMovie.title}`,
        order_id: order.id,
        handler: async function(response) {
          try {
            const userId = localStorage.getItem('userId');
            if (!userId) throw new Error('User ID not found');

            const rentalDetails = {
              movie: {
                id: rentalMovie.id,
                title: rentalMovie.title,
                poster_path: rentalMovie.poster_path,
                overview: rentalMovie.overview,
                release_date: rentalMovie.release_date,
                vote_average: rentalMovie.vote_average
              },
              rentalPrice: RENTAL_PRICE,
              rentalPeriod: '48 hours',
              user: userId
            };

            const requestBody = {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              rentalDetails
            };

            const verifyRes = await fetch('https://cinemaconnect-backend.onrender.com/api/payment/verify-rental', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(requestBody)
            });

            if (!verifyRes.ok) {
              const errorData = await verifyRes.json();
              throw new Error(errorData.error || 'Rental payment verification failed');
            }

            const data = await verifyRes.json();
            if (data.success) {
              setRentalSuccess(true);
              setTimeout(() => {
                setShowRentalModal(false);
                navigate('/my-bookings');
              }, 2000);
            } else {
              setRentalError(data.error || 'Rental payment verification failed');
            }
          } catch (err) {
            setRentalError(err.message || 'Rental payment verification failed');
          }
        },
        prefill: {
          name: 'Customer Name',
          email: 'customer@example.com',
          contact: '9999999999'
        },
        theme: { color: '#4CAF50' }
      };
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setRentalError('Failed to process rental payment');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleViewDescription = (movie) => {
    setSelectedMovie(movie);
    setShowDescriptionModal(true);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading movies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={fetchMovies} className="retry-button">Try Again</button>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="movies-container">
        <h1 className="section-title">
          {searchQuery ? `Search Results for "${searchQuery}"` : activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
        </h1>
        {movies.length === 0 ? (
          <div className="no-movies"><p>No movies found</p></div>
        ) : (
          <div className="movie-grid">
            {movies.map((movie) => {
              const releaseDate = new Date(movie.release_date);
              const today = new Date();
              const oneMonthAgo = new Date();
              oneMonthAgo.setMonth(today.getMonth() - 1);
              const oneMonthLater = new Date();
              oneMonthLater.setMonth(today.getMonth() + 1);
              
              const isInBookingWindow = releaseDate >= oneMonthAgo && releaseDate <= oneMonthLater;
              const isOlderThanMonth = releaseDate < oneMonthAgo;

              return (
                <div key={movie.id} className="movie-card">
                  <div 
                    className="movie-poster" 
                    style={{ backgroundImage: `url(${movie.poster_path || 'https://via.placeholder.com/500x750?text=No+Poster'})` }}
                  >
                    {activeSection !== 'upcoming' && isInBookingWindow && (
                      <div className="now-playing-badge">Now Playing</div>
                    )}
                  </div>
                  <div className="movie-info">
                    <h3>{movie.title}</h3>
                    <div className="movie-meta">
                      <div className="movie-rating"><span className="rating-star">★</span>{movie.vote_average?.toFixed(1)}</div>
                      <div className="movie-release">{formatDate(movie.release_date)}</div>
                    </div>
                    {activeSection === 'upcoming' ? (
                      <button className="description-button" onClick={() => handleViewDescription(movie)}>View Description</button>
                    ) : isOlderThanMonth ? (
                      <button className="rent-button" onClick={() => handleRentClick(movie)}>Rent for ₹{RENTAL_PRICE}</button>
                    ) : (
                      <button className="book-button" onClick={() => handleBookTicket(movie)}>
                        {isInBookingWindow ? 'Book Now' : 'Coming Soon'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Description Modal */}
      {showDescriptionModal && selectedMovie && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedMovie.title}</h2>
              <button className="close-button" onClick={() => setShowDescriptionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <img 
                src={selectedMovie.poster_path || 'https://via.placeholder.com/500x750?text=No+Poster'} 
                alt={selectedMovie.title} 
                className="modal-poster"
              />
              <div className="movie-details">
                <div className="movie-meta">
                  <div className="movie-rating"><span className="rating-star">★</span>{selectedMovie.vote_average?.toFixed(1)}</div>
                  <div className="movie-release">{formatDate(selectedMovie.release_date)}</div>
                </div>
                <div className="movie-description">
                  <h3>Overview</h3>
                  <p>{selectedMovie.overview}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rental Modal */}
      {showRentalModal && rentalMovie && (
        <div className="rental-modal-overlay">
          <div className="rental-modal">
            <h2>{rentalMovie.title}</h2>
            <img src={rentalMovie.poster_path || 'https://via.placeholder.com/500x750?text=No+Poster'} alt={rentalMovie.title} style={{ width: '200px', borderRadius: '8px', marginBottom: '1rem' }} />
            <p><strong>Description:</strong> {rentalMovie.overview}</p>
            <p><strong>Rental Policy:</strong> {RENTAL_POLICY}</p>
            <p><strong>Rental Price:</strong> ₹{RENTAL_PRICE}</p>
            {rentalError && <div className="error-message">{rentalError}</div>}
            {rentalSuccess ? (
              <div className="success-message">Rental successful! Movie will be available in My Bookings.</div>
            ) : (
              <>
                <button className="rent-confirm-button" onClick={handleRentMovie}>Rent Movie</button>
                <button className="cancel-button" onClick={() => setShowRentalModal(false)}>Cancel</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
