import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import styles from './SubastaActiva.module.scss';

interface Message {
  user: string;
  text: string;
  time: string;
  isOffer?: boolean;
}

const loteInfo = {
  nombre: 'Heladería con elaboración',
  ubicacion: 'Castelar, Buenos Aires',
  descripcion:
    'Alguna información relevante o interesante pero detallar en un muy breve texto descriptivo, que no dure más que esto.',
  martillero: 'JUAN JANITEZ',
  imagenes: ['/assets/img/default.png', '/assets/img/default.png', '/assets/img/default.png'],
};

const BASELINE = 1000000;
const INCREMENT = 50000;

export default function SubastaActiva() {
  // El id de la ruta se usará más adelante para pedir los datos reales al backend
  const { id } = useParams<{ id: string }>();
  void id;

  const [currentBid, setCurrentBid] = useState(BASELINE);
  const [userCredits] = useState(20000000);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { user: 'Sistema', text: 'Bienvenido a la subasta en vivo.', time: '16:00' },
    { user: 'Martillero', text: 'Iniciamos la puja por este excelente lote.', time: '16:01' },
    { user: 'Usuario_123', text: 'Ofertó $1.000.000', time: '16:02', isOffer: true },
  ]);
  const [newMessage, setNewMessage] = useState('');

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

  const increaseBid = () => setCurrentBid((v) => v + INCREMENT);
  const decreaseBid = () => setCurrentBid((v) => (v > BASELINE ? v - INCREMENT : v));

  const onlyNumbers = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
    }
  };

  const placeOffer = () => {
    const amount = currentBid;

    if (!amount || amount <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    if (amount > userCredits) {
      alert('No tienes crédito suficiente para esta oferta.');
      return;
    }

    if (amount < BASELINE) {
      alert('La oferta no puede ser menor al precio base ($1.000.000).');
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { user: 'Tú', text: `Ofertó $${amount.toLocaleString('es-AR')}`, time, isOffer: true },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          user: 'Martillero',
          text: `¡Nueva oferta recibida de $${amount.toLocaleString('es-AR')}!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1000);
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [...prev, { user: 'Tú', text: newMessage, time }]);
      setNewMessage('');
    }
  };

  const onChatKeyUp = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className={styles.activeAuctionContainer}>
      <div className={styles.auctionHeader}>
        <h1>SUBASTA ACTIVA · EN VIVO</h1>
      </div>

      <div className={styles.auctionGrid}>
        <div className={styles.mainContent}>
          <div className={styles.streamContainer}>
            <div className={styles.videoPlaceholder}>
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth={1}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <div className={styles.streamBanner}>
              <span className={styles.bannerText}>SE VENDE EN ${currentBid.toLocaleString('es-AR')}</span>
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
            <button className={styles.offerBtn} onClick={placeOffer}>OFERTAR</button>
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
                    <div className={`${styles.message} ${msg.isOffer ? styles.isOffer : ''}`} key={i}>
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
