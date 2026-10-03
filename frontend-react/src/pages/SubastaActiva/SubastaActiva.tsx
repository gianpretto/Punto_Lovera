import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import LivePlayer from '../../components/LivePlayer/LivePlayer';
import { useAuth } from '../../services/AuthContext';
import { getToken, uploadUrl } from '../../services/api';
import { useAuctionRoom } from '../../services/useAuctionRoom';
import styles from './SubastaActiva.module.scss';

const IMAGEN_DEFAULT = '/assets/img/default.png';

export default function SubastaActiva() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Con sesión se puja/chatea; sin sesión se mira como espectador
  const { state, messages, error, placeBid, sendMessage: emitMessage } = useAuctionRoom(
    id,
    user ? getToken() : null,
    { onError: (message) => alert(message) }
  );

  const lot = state?.lot ?? null;
  const esMartillero = user?.role === 'MARTILLERO' || user?.role === 'ADMIN';
  const loteInfo = {
    nombre: lot ? lot.title : error ?? (state ? 'No quedan lotes en remate' : 'Conectando con la sala...'),
    ubicacion: state?.auction.location ?? '',
    descripcion: lot?.description ?? '',
    martillero: state?.auction.martillero?.toUpperCase() ?? '',
    imagenes: lot && lot.images.length > 0 ? lot.images.map(uploadUrl) : [IMAGEN_DEFAULT],
  };
  const minNextBid = lot?.minNextBid ?? 0;
  const increment = lot?.bidIncrement ?? 0;

  const [currentBid, setCurrentBid] = useState(0);
  const userCredits = user?.creditBalance ?? 0;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Cambió el lote en remate: volver a la primera foto
  useEffect(() => {
    setCurrentIndex(0);
  }, [lot?.id]);

  // Si alguien pujó y la oferta que estaba armando quedó por debajo del
  // mínimo, la subimos al mínimo nuevo
  useEffect(() => {
    setCurrentBid((v) => (v < minNextBid ? minNextBid : v));
  }, [minNextBid]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = () => {
    setIsChatExpanded((v) => {
      const next = !v;
      if (next) setTimeout(scrollToBottom, 100);
      return next;
    });
  };

  const openLightbox = () => setIsLightboxOpen(true);
  const closeLightbox = () => setIsLightboxOpen(false);
  const nextImage = () => setCurrentIndex((i) => (i + 1) % loteInfo.imagenes.length);
  const prevImage = () => setCurrentIndex((i) => (i - 1 + loteInfo.imagenes.length) % loteInfo.imagenes.length);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowRight') nextImage();
      if (event.key === 'ArrowLeft') prevImage();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLightboxOpen]);

  const formattedBid = currentBid.toLocaleString('es-AR');

  const onBidInputChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setCurrentBid(numericValue ? parseInt(numericValue, 10) : 0);
  };

  const increaseBid = () => setCurrentBid((v) => v + increment);
  const decreaseBid = () => setCurrentBid((v) => (v - increment >= minNextBid ? v - increment : v));

  const onlyNumbers = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  };

  const placeOffer = () => {
    const amount = currentBid;

    if (!user) {
      alert('Tenés que iniciar sesión para ofertar.');
      navigate('/login');
      return;
    }

    if (!lot) {
      alert('No hay ningún lote en remate en este momento.');
      return;
    }

    if (!amount || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    if (amount > userCredits) {
      alert('No tienes crédito suficiente para esta oferta.');
      return;
    }

    if (amount < minNextBid) {
      alert(`La oferta mínima es $${minNextBid.toLocaleString('es-AR')}.`);
      return;
    }

    // La confirmación llega por el socket (bid:new + mensaje en el chat)
    placeBid(lot.id, amount);
  };

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    if (!user) {
      alert('Tenés que iniciar sesión para chatear.');
      return;
    }
    // El mensaje vuelve por el socket a toda la sala (incluido uno mismo)
    emitMessage(newMessage);
    setNewMessage('');
  };

  const onChatKeyUp = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className={styles.activeAuctionContainer}>
      <div className={styles.auctionHeader}>
        <h1>SUBASTA ACTIVA · EN VIVO</h1>
        {esMartillero && (
          <Link to={`/subastas/${id}/martillero`} className={styles.panelLink}>
            Panel del martillero
          </Link>
        )}
      </div>

      <div className={styles.auctionGrid}>
        <div className={styles.mainContent}>
          <div className={styles.streamContainer}>
            {id && (
              <LivePlayer
                auctionId={id}
                cameraId={state?.auction.cameraId ?? null}
                token={user ? getToken() : null}
                placeholder={
                  <div className={styles.videoPlaceholder}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={1}>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                }
              />
            )}
            <div className={styles.streamBanner}>
              <span className={styles.bannerText}>SE VENDE EN ${(lot?.currentPrice ?? 0).toLocaleString('es-AR')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>

          <div className={styles.biddingSection}>
            <div className={styles.bidSelector}>
              <button className={styles.bidBtn} onClick={decreaseBid}>-</button>
              <div className={styles.bidDisplay}>
                <div className={styles.bidFieldWrapper}>
                  <span className={styles.currencySymbol}>$</span>
                  <input
                    type="text"
                    className={styles.bidInput}
                    value={formattedBid}
                    onChange={(e) => onBidInputChange(e.target.value)}
                    onKeyPress={onlyNumbers}
                  />
                </div>
                <span className={styles.userCredits}>TUS CRÉDITOS: ${userCredits.toLocaleString('es-AR')}</span>
              </div>
              <button className={styles.bidBtn} onClick={increaseBid}>+</button>
            </div>
            <button className={styles.offerBtn} onClick={placeOffer} disabled={!lot}>OFERTAR</button>
          </div>
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <div className={styles.martilleroVideoBlock}>
              <div className={styles.cameraPlaceholder}>
                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={1}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
            </div>

            <div className={styles.martilleroBanner}>
              <span className={styles.label}>MARTILLERO</span>
              <span className={styles.name}>{loteInfo.martillero}</span>
            </div>

            <button className={styles.toggleChatBtn} onClick={toggleChat}>
              {isChatExpanded ? '^ Ocultar chat y descripción' : 'v Mostrar chat y descripción'}
            </button>

            <div className={`${styles.sidebarBody} ${!isChatExpanded ? styles.collapsed : ''}`}>
              <div className={styles.loteInfoCompact}>
                <div className={styles.titleRow}>
                  <h3>{loteInfo.nombre}</h3>
                  <button className={styles.btnNegroExtraSmall} onClick={openLightbox}>VER LOTE</button>
                </div>
                <p className={styles.location}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {loteInfo.ubicacion}
                </p>
                <p className={styles.descriptionShort}>{loteInfo.descripcion}</p>
              </div>

              <hr className={styles.sidebarDivider} />

              <div className={styles.chatContainerInner}>
                <div className={styles.chatHeaderMinimal}>CHAT EN VIVO ·</div>
                <div className={styles.chatMessagesScroll} ref={scrollRef}>
                  {messages.map((msg, i) => (
                    <div className={`${styles.message} ${msg.isOffer ? styles.isOffer : ''}`} key={msg.id ?? `local-${i}`}>
                      <span className={styles.messageUser}>{msg.user}:</span>
                      <span className={styles.messageText}>{msg.text}</span>
                      <span className={styles.messageTime}>{msg.time}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.chatInputRow}>
                  <input
                    type="text"
                    placeholder="Tu mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyUp={onChatKeyUp}
                  />
                  <button className={styles.sendBtn} onClick={sendMessage}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {isLightboxOpen && (
        <div className={styles.lightboxOverlay} onClick={closeLightbox}>
          <div className={styles.lightboxContainer} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={closeLightbox}>×</button>

            <div className={styles.mediaViewer}>
              <img src={loteInfo.imagenes[currentIndex]} alt="Lote Media" />

              <button className={`${styles.navBtn} ${styles.prev}`} onClick={prevImage}>‹</button>
              <button className={`${styles.navBtn} ${styles.next}`} onClick={nextImage}>›</button>
            </div>

            <div className={styles.lightboxFooter}>
              <p>{loteInfo.nombre} - Imagen {currentIndex + 1} de {loteInfo.imagenes.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
