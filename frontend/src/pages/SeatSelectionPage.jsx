import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import '../styles/SeatSelectionPage.css';

const RAZORPAY_KEY = 'rzp_test_pZ7rJCEC6C1nZd';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://cinemaconnect.onrender.com';

const SeatSelectionPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const { movie, theater, screen, date } = state;

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [lockedSeats, setLockedSeats] = useState(new Set());
  const [bookedSeats, setBookedSeats] = useState(new Set());
  const [showMovieDetails, setShowMovieDetails] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: true });
    setSocket(newSocket);

    if (screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.id) {
      newSocket.emit('joinShowtime', screen.showtimes.id);
    }

    newSocket.on('bookedSeats', ({ seatIds }) => {
      setBookedSeats(new Set(seatIds));
    });

    newSocket.on('seatSelected', ({ seatId }) => {
      setLockedSeats(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.add(seatId);
        return newSet;
      });
    });

    newSocket.on('seatReleased', ({ seatId }) => {
      setLockedSeats(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(seatId);
        return newSet;
      });
    });

    newSocket.on('bookingConfirmed', ({ seatIds }) => {
      setLockedSeats(prev => {
        const newSet = new Set(Array.from(prev));
        seatIds.forEach(id => newSet.delete(id));
        return newSet;
      });
      setBookedSeats(prev => {
        const newSet = new Set(Array.from(prev));
        seatIds.forEach(id => newSet.add(id));
        return newSet;
      });
    });

    newSocket.on('seatSelectionError', ({ seatId, message }) => {
      setError(message);
      setSelectedSeats(prev => prev.filter(seat => seat.id !== seatId));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [screen && screen.showtimes]);

  const handleSeatClick = (seat) => {
    if (seat.isBooked || lockedSeats.has(seat.id) || bookedSeats.has(seat.id)) return;

    const userId = localStorage.getItem('userId') || 'anonymous';
    const showtimeId = screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.id;
    if (!showtimeId) {
      setError('Invalid showtime');
      return;
    }

    socket && socket.emit('selectSeat', { showtimeId, seatId: seat.id, userId });

    setSelectedSeats(prevSeats => {
      const isSelected = prevSeats.some(s => s.id === seat.id);
      if (isSelected) {
        socket && socket.emit('releaseSeat', { showtimeId, seatId: seat.id, userId });
        return prevSeats.filter(s => s.id !== seat.id);
      } else {
        if (prevSeats.length >= 10) {
          setError('You can select up to 10 seats only');
          return prevSeats;
        }
        setError(null);
        return [...prevSeats, seat];
      }
    });
  };

  const initializeRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRentMovie = async () => {
    try {
      const res = await initializeRazorpay();
      if (!res) {
        setError('Razorpay SDK failed to load');
        return;
      }
      const response = await fetch('https://cinemaconnect.onrender.com/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 199 * 100 }),
      });
      const order = await response.json();

      const options = {
        key: RAZORPAY_KEY,
        amount: 199 * 100,
        currency: 'INR',
        name: 'Cinema Connect',
        description: `Movie Rental: ${movie && movie.title}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verificationResponse = await fetch('https://cinemaconnect.onrender.com/api/payment/verify-rental', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                rentalDetails: { movie, rentalPrice: 199, rentalPeriod: '48 hours' }
              }),
            });
            const data = await verificationResponse.json();

            if (data.success) {
              navigate('/profile', {
                state: {
                  rentalSuccess: true,
                  movie,
                  rentalPeriod: '48 hours',
                  paymentId: response.razorpay_payment_id
                }
              });
            } else {
              setError('Rental payment verification failed');
            }
          } catch (err) {
            setError('Rental payment verification failed');
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
      setError('Failed to process rental payment');
    }
  };

  const handleProceed = () => {
    if (selectedSeats.length === 0) {
      setError('Please select at least one seat');
      return;
    }
    if (!screen || !screen.showtimes || !screen.showtimes[0]) {
      setError('Invalid showtime data');
      return;
    }
    setShowMovieDetails(true);
  };

  const handlePayment = async () => {
    if (!screen || !screen.showtimes || !screen.showtimes || !screen.showtimes.price) {
      setError('Invalid showtime or price data');
      return;
    }
    const totalAmount = selectedSeats.length * screen.showtimes.price;
    try {
      const res = await initializeRazorpay();
      if (!res) {
        setError('Razorpay SDK failed to load');
        return;
      }
      const response = await fetch('https://cinemaconnect.onrender.com/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalAmount * 100 }),
      });
      const order = await response.json();

      const options = {
        key: RAZORPAY_KEY,
        amount: totalAmount * 100,
        currency: 'INR',
        name: 'Cinema Connect',
        description: `Booking for ${movie && movie.title}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verificationResponse = await fetch('https://cinemaconnect.onrender.com/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                bookingDetails: {
                  user: localStorage.getItem('userId') || '',
                  movie: {
                    id: movie && movie.id ? movie.id : '',
                    title: movie && movie.title ? movie.title : '',
                    poster_path: movie && movie.poster_path ? movie.poster_path : ''
                  },
                  theater: {
                    id: theater && theater.id ? theater.id : `theater_${theater && theater.name ? theater.name.replace(/\s+/g, '_').toLowerCase() : 'unknown'}_${Date.now()}`,
                    name: theater && theater.name ? theater.name : ''
                  },
                  screen: {
                    id: screen && screen.id ? screen.id : `screen_${screen && screen.name ? screen.name.replace(/\s+/g, '_').toLowerCase() : 'unknown'}_${Date.now()}`,
                    name: screen && screen.name ? screen.name : ''
                  },
                  showtime: {
                    id: screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.id ? screen.showtimes.id : `showtime_${Date.now()}`,
                    time: screen && screen.showtimes && screen.showtimes && screen.showtimes.time ? screen.showtimes.time : '',
                    price: screen && screen.showtimes && screen.showtimes && screen.showtimes.price ? screen.showtimes.price : 0
                  },
                  seats: selectedSeats.map(seat => ({
                    id: seat && seat.id ? seat.id : `seat_${seat && seat.row ? seat.row : ''}_${seat && seat.number ? seat.number : 0}_${Date.now()}`,
                    row: seat && seat.row ? seat.row : '',
                    number: seat && seat.number ? seat.number : 0
                  })),
                  date: date instanceof Date ? date.toISOString() : (date || new Date().toISOString()),
                  payment: {
                    method: 'razorpay',
                    amount: totalAmount || 0,
                    paymentId: response.razorpay_payment_id || '',
                    status: 'success'
                  },
                  status: 'confirmed'
                }
              }),
            });
            const data = await verificationResponse.json();

            if (data.success || data.status === 'success' || (data && typeof data === 'object' && Object.keys(data).length > 0)) {
              try {
                const token = localStorage.getItem('token');
                const bookingResponse = await fetch('https://cinemaconnect.onrender.com/api/bookings', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                  },
                  body: JSON.stringify({
                    user: localStorage.getItem('userId') || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user') || '{}')._id : undefined),
                    movie: { id: movie && movie.id, title: movie && movie.title, poster_path: movie && movie.poster_path },
                    theater: { id: theater && theater.id ? theater.id : `theater_${Date.now()}`, name: theater && theater.name },
                    screen: { id: screen && screen.id, name: screen && screen.name },
                    showtime: { id: screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.id, time: screen && screen.showtimes && screen.showtimes && screen.showtimes.time, price: screen && screen.showtimes && screen.showtimes && screen.showtimes.price },
                    seats: selectedSeats.map(seat => ({ id: seat.id, row: seat.row, number: seat.number })),
                    date: date instanceof Date ? date.toISOString() : date,
                    payment: {
                      method: 'razorpay',
                      amount: selectedSeats.length * (screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.price ? screen.showtimes.price : 0),
                      paymentId: response.razorpay_payment_id,
                      status: 'success'
                    },
                    status: 'confirmed'
                  })
                });
                const bookingData = await bookingResponse.json();
                if (bookingData.emailStatus === 'failed') {
                  console.error('Failed to send confirmation email');
                }
              } catch (e) {}
              navigate('/confirmation', {
                state: {
                  movie, theater, screen, date, selectedSeats,
                  totalAmount: selectedSeats.length * (screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.price ? screen.showtimes.price : 0),
                  paymentMethod: 'razorpay',
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id
                }
              });
            } else {
              setError('Payment verification failed');
            }
          } catch (err) {
            setError('Payment verification failed');
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
      setError('Failed to process payment');
    }
  };

  const formatDate = (dateValue) => {
    return new Date(dateValue).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!movie || !theater || !screen || !date) {
    return (
      <div className="seat-selection-page">
        <div className="error-message">Invalid booking data. Please start over.</div>
      </div>
    );
  }

  const seatArrangement = {
    'A': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: false }],
    'B': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: false }],
    'C': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: false }],
    'D': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: false }],
    'E': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: true }],
    'F': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: true }],
    'G': [{ numbers: [1,2,3,4,5,6,7,8,9,10], isPremium: true }]
  };

  return (
    <div className="seat-selection-page">
      {showMovieDetails && (
        <div className="movie-details-modal">
          <div className="modal-content">
            <h2>Movie Rental Details</h2>
            <div className="movie-details">
              <img src={`https://image.tmdb.org/t/p/w500${movie && movie.poster_path}`} alt={movie && movie.title} className="movie-poster" />
              <div className="movie-info-details">
                <h3>{movie && movie.title}</h3>
                <p><strong>Runtime:</strong> {movie && movie.runtime} minutes</p>
                <p><strong>Release Date:</strong> {movie && movie.release_date}</p>
                <p><strong>Rating:</strong> {movie && movie.vote_average}/10</p>
                <p><strong>Genre:</strong> {Array.isArray(movie && movie.genre) ? movie.genre.join(', ') : 'N/A'}</p>
                <p><strong>Overview:</strong> {movie && movie.overview}</p>
                <div className="rental-info">
                  <p><strong>Rental Period:</strong> 48 hours</p>
                  <p><strong>Rental Price:</strong> ₹199</p>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowMovieDetails(false)}>Cancel</button>
              <button className="rent-confirm-button" onClick={handleRentMovie}>Rent Now</button>
            </div>
          </div>
        </div>
      )}
      {showMovieDetails && (
        <div className="movie-details-modal">
          <div className="modal-content">
            <h2>Booking Details</h2>
            <div className="movie-details">
              <h3>{movie && movie.title}</h3>
              <p><strong>Runtime:</strong> {movie && movie.runtime} minutes</p>
              <p><strong>Release Date:</strong> {movie && movie.release_date}</p>
              <p><strong>Rating:</strong> {movie && movie.vote_average}/10</p>
              <p><strong>Overview:</strong> {movie && movie.overview}</p>
              <div className="booking-details">
                <p><strong>Theater:</strong> {theater && theater.name}</p>
                <p><strong>Screen:</strong> {screen && screen.name}</p>
                <p><strong>Date:</strong> {formatDate(date)}</p>
                <p><strong>Time:</strong> {screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.time}</p>
                <p><strong>Selected Seats:</strong> {selectedSeats.length > 0 ? selectedSeats.map(seat => `${seat.row}${seat.number}`).join(', ') : 'None selected'}</p>
                <p><strong>Total Amount:</strong> ₹{selectedSeats.length * (screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.price ? screen.showtimes.price : 0)}</p>
              </div>
            </div>
            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowMovieDetails(false)}>Cancel</button>
              <button className="confirm-button" onClick={handlePayment}>Confirm & Pay</button>
            </div>
          </div>
        </div>
      )}
      <div className="seat-selection-container">
        <div className="booking-header">
          <h1>Select Your Seats</h1>
          <div className="booking-info">
            <div className="movie-info">
              <h2>{movie && movie.title}</h2>
              <div className="booking-details">
                <span>{theater && theater.name}</span>
                <span>•</span>
                <span>{screen && screen.name}</span>
                <span>•</span>
                <span>{formatDate(date)}</span>
                <span>•</span>
                <span>{screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.time}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="seat-selection-content">
          <div className="seat-map-container">
            <div className="screen">Screen</div>
            <div className="seat-map">
              {Object.entries(seatArrangement).map(([row, sections]) => (
                <div key={row} className="seat-row">
                  <div className="row-label">{row}</div>
                  {sections.map(section =>
                    section.numbers.map(seatNumber => {
                      const seat = screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.seats && screen.showtimes.seats.find(
                        s => s.row === row && s.number === seatNumber
                      );
                      if (!seat) {
                        return (
                          <div key={`${row}${seatNumber}`} className="seat-spacer" />
                        );
                      }
                      const isSelected = selectedSeats.some(s => s.id === seat.id);
                      const isLocked = lockedSeats.has(seat.id);
                      const isBooked = seat.isBooked || bookedSeats.has(seat.id);
                      return (
                        <div
                          key={seat.id}
                          className={`seat${isBooked ? ' booked' : ''}${isSelected ? ' selected' : ''}${section.isPremium ? ' premium' : ''}${isLocked ? ' locked' : ''}`}
                          onClick={() => handleSeatClick(seat)}
                          title={`Seat ${seat.row}${seat.number}`}
                        >
                          <span className="seat-number">{seatNumber}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
            <div className="seat-legend">
              <div className="legend-item">
                <div className="seat"></div>
                <span>Standard</span>
              </div>
              <div className="legend-item">
                <div className="seat premium"></div>
                <span>Premium</span>
              </div>
              <div className="legend-item">
                <div className="seat selected"></div>
                <span>Selected</span>
              </div>
              <div className="legend-item">
                <div className="seat booked"></div>
                <span>Booked</span>
              </div>
            </div>
          </div>
          <div className="booking-summary">
            <h3>Booking Summary</h3>
            {selectedSeats.length > 0 ? (
              <>
                <div className="selected-seats">
                  <h4>Selected Seats</h4>
                  <div className="seat-tags">
                    {selectedSeats.map(seat => (
                      <span key={seat.id} className="seat-tag">
                        {seat.row}{seat.number}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="price-summary">
                  <div className="price-row">
                    <span>Ticket Price</span>
                    <span>₹{screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.price}</span>
                  </div>
                  <div className="price-row">
                    <span>Number of Seats</span>
                    <span>× {selectedSeats.length}</span>
                  </div>
                  <div className="price-row total">
                    <span>Total Amount</span>
                    <span>₹{selectedSeats.length * (screen && screen.showtimes && screen.showtimes[0] && screen.showtimes.price ? screen.showtimes.price : 0)}</span>
                  </div>
                </div>
                <div className="booking-actions">
                  <button className="proceed-button" onClick={handleProceed}>
                    Book Tickets
                  </button>
                </div>
              </>
            ) : (
              <p className="no-seats-message">Please select your seats</p>
            )}
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatSelectionPage;
