import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MyBookingsPage.css';

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        setError('Please log in to view your bookings');
        setLoading(false);
        return;
      }

      console.log('Fetching bookings with token:', token.substring(0, 10) + '...');

      const response = await fetch('http://localhost:5000/api/bookings/my-bookings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed:', response.status);
        setError('Your session has expired. Please log in again.');
        localStorage.removeItem('token');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch bookings:', response.status, errorData);
        throw new Error(errorData.message || `Failed to fetch bookings (${response.status})`);
      }

      const data = await response.json();
      console.log('Bookings fetched successfully:', data.length);
      setBookings(data);
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'cancelled':
        return 'status-cancelled';
      case 'pending':
        return 'status-pending';
      default:
        return '';
    }
  };

  if (loading) {
    return <div className="bookings-page loading">Loading your bookings...</div>;
  }

  if (error) {
    return <div className="bookings-page error">{error}</div>;
  }

  const handlePrint = (booking) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print tickets');
      return;
    }

    const bookingId = booking._id || `BKG${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    const ticketHTML = `
      <html>
        <head>
          <title>Cinema Connect - E-Ticket</title>
          <style>
            body { font-family: 'Roboto', Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background-color: #f5f5f5; }
            .confirmation-card { background-color: white; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); padding: 30px; text-align: center; }
            .confirmation-card h1 { color: #4CAF50; margin-bottom: 30px; font-size: 28px; }
            .ticket-container { margin: 20px 0; perspective: 1000px; }
            .ticket { background: linear-gradient(145deg, #ffffff, #f0f0f0); border-radius: 15px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); overflow: hidden; }
            .ticket-header { background-color: #4CAF50; color: white; padding: 15px; text-align: center; }
            .ticket-body { padding: 20px; display: flex; justify-content: space-between; position: relative; }
            .ticket-body:after { content: ''; position: absolute; top: 0; bottom: 0; right: 120px; border-right: 2px dashed #ccc; }
            .movie-details { flex: 1; padding-right: 20px; text-align: left; }
            .ticket-info { display: grid; gap: 12px; }
            .ticket-qr { width: 100px; text-align: center; }
            .qr-placeholder { width: 80px; height: 80px; background-color: #f0f0f0; display: flex; justify-content: center; align-items: center; margin: 0 auto 10px; border: 1px solid #ddd; }
            .booking-id { font-size: 12px; color: #666; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="confirmation-card">
            <h1>Booking Confirmed!</h1>
            <div class="ticket-container">
              <div class="ticket">
                <div class="ticket-header">
                  <h2>CinemaConnect</h2>
                  <p>E-Ticket</p>
                </div>
                <div class="ticket-body">
                  <div class="movie-details">
                    <h3>${booking.movie?.title || 'Movie Title'}</h3>
                    <div class="ticket-info">
                      <div>Date: ${new Date(booking.date).toLocaleDateString()}</div>
                      <div>Theater: ${booking.theater?.name || 'N/A'}</div>
                      <div>Screen: ${booking.screen?.name || 'N/A'}</div>
                      <div>Time: ${booking.showtime?.time || 'N/A'}</div>
                      <div>Seats: ${Array.isArray(booking.seats) ? booking.seats.map(seat => `${seat.row}${seat.number}`).join(', ') : 'N/A'}</div>
                    </div>
                  </div>
                  <div class="ticket-qr">
                    <div class="qr-placeholder">QR</div>
                    <div class="booking-id">${bookingId}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(ticketHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const rentedMovies = bookings.filter(b => b.isRental);
  const ticketBookings = bookings.filter(b => !b.isRental);

  return (
    <div className="bookings-page">
      <div className="bookings-container">
        <h1>My Bookings</h1>

        {/* Rented Movies */}
        {rentedMovies.length > 0 && (
          <div className="rented-movies-section">
            <h2>Rented Movies</h2>
            <div className="bookings-list">
              {rentedMovies.map((booking) => (
                <div key={booking._id} className="booking-card">
                  <div className="booking-header">
                    {booking.movie.poster_path && (
                      <div className="movie-poster">
                        <img 
                          src={`https://image.tmdb.org/t/p/w200${booking.movie.poster_path}`} 
                          alt={booking.movie.title || 'Movie Poster'} 
                        />
                      </div>
                    )}
                    <div className="booking-title-section">
                      <h2>{booking.movie?.title || 'Movie Title Not Available'}</h2>
                      <span className={`booking-status ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                  <div className="booking-details">
                    <p><b>Rental Period:</b> {booking.rentalPeriod || '48 hours'}</p>
                    <p><b>Amount Paid:</b> ₹{booking.payment?.amount}</p>
                    <p><b>Booking Date:</b> {formatDate(booking.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ticket Bookings */}
        {ticketBookings.length > 0 && (
          <div className="ticket-bookings-section">
            <h2>Ticket Bookings</h2>
            <div className="bookings-list">
              {ticketBookings.map((booking) => (
                <div key={booking._id} className="booking-card">
                  <div className="booking-header">
                    {booking.movie.poster_path && (
                      <div className="movie-poster">
                        <img 
                          src={`https://image.tmdb.org/t/p/w200${booking.movie.poster_path}`} 
                          alt={booking.movie.title || 'Movie Poster'} 
                        />
                      </div>
                    )}
                    <div className="booking-title-section">
                      <h2>{booking.movie?.title || 'Movie Title Not Available'}</h2>
                      <span className={`booking-status ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                    <button 
                      className="print-ticket-btn" 
                      onClick={() => handlePrint(booking)}
                    >
                      🖨 Print Ticket
                    </button>
                  </div>
                  <div className="booking-details">
                    <p><b>Theater:</b> {booking.theater?.name}</p>
                    <p><b>Screen:</b> {booking.screen?.name}</p>
                    <p><b>Show Time:</b> {booking.showtime?.time}</p>
                    <p><b>Seats:</b> {booking.seats?.map(seat => `${seat.row}${seat.number}`).join(', ')}</p>
                    <p><b>Amount Paid:</b> ₹{booking.payment?.amount}</p>
                    <p><b>Booking Date:</b> {formatDate(booking.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookingsPage;
