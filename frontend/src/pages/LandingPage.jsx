import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../modules/auth/context/useAuth";

const BG_AUDIO_URL =
  "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3";

export default function LandingPage() {
  const { isAuthenticated, user } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);

  // Reviews State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewName, setReviewName] = useState("");
  const [reviewDrink, setReviewDrink] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const [reviewsList, setReviewsList] = useState([
    {
      id: 1,
      name: "Camille Santos",
      role: "Verified Guest",
      rating: 5,
      drink: "Artisan Spanish Latte",
      date: "Yesterday",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80",
      comment:
        "The Artisan Spanish Latte is easily the best in the city. Perfectly balanced sweetness, bold espresso punch, and the warm cinnamon dust makes it irresistible every single morning.",
    },
    {
      id: 2,
      name: "Mark Villafuerte",
      role: "Pour-Over Connoisseur",
      rating: 5,
      drink: "Single-Origin Benguet V60",
      date: "3 days ago",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
      comment:
        "As someone who drinks single-origin manual pour-overs exclusively, their Benguet Arabica completely blew me away. Crisp jasmine floral aroma, clean bergamot finish, and the baristas genuinely understand extraction science.",
    },
    {
      id: 3,
      name: "Arianne Chen",
      role: "Digital Nomad & Designer",
      rating: 5,
      drink: "Sea Salt Caramel Cold Brew",
      date: "1 week ago",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&q=80",
      comment:
        "The ambience is cozy, the lo-fi cafe playlist is soothing, and the Sea Salt Caramel cold foam is dangerously delicious. Reliable WiFi and ergonomic seating make it my favorite work-from-cafe spot!",
    },
    {
      id: 4,
      name: "Dave Ramos",
      role: "Daily Commuter",
      rating: 5,
      drink: "Velvet Flat White",
      date: "2 weeks ago",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
      comment:
        "Super seamless online ordering and 4-digit pickup code system. I placed my order on my phone on the jeepney, arrived, and my flat white was freshly poured with perfect microfoam within 2 minutes.",
    },
  ]);

  const audioRef = useRef(null);

  // Navbar scroll background change
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Audio volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  function toggleAudio() {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Audio autoplay blocked or failed:", err);
          setIsPlaying(false);
        });
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }

  function handleReviewSubmit(e) {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    const newReview = {
      id: Date.now(),
      name: reviewName.trim(),
      role: "Verified Guest",
      rating: reviewRating,
      drink: reviewDrink.trim() || "House Specialty Drink",
      date: "Just now",
      avatar: null,
      comment: reviewComment.trim(),
    };

    setReviewsList([newReview, ...reviewsList]);
    setReviewSubmitted(true);
    setReviewName("");
    setReviewDrink("");
    setReviewComment("");
    setReviewRating(5);

    setTimeout(() => {
      setReviewSubmitted(false);
    }, 5000);
  }

  return (
    <div className="min-h-screen bg-[#140e08] text-[#f5e6d3] font-sans antialiased selection:bg-[#c8860a] selection:text-[#140e08]">
      {/* Background Cafe Audio Loop */}
      <audio ref={audioRef} src={BG_AUDIO_URL} loop preload="auto" />

      {/* Top Banner Notice */}
      <div className="border-b border-[#c8860a]/20 bg-[#1e1509] px-4 py-2 text-center text-xs font-semibold text-[#e6a832]">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="truncate">
            ☕ Welcome to LDRN&apos;s Coffee — Freshly Roasted Beans &amp; Handcrafted Brews in Cebu City
          </span>
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-[#b8a08a]">
            <span>Daily: 5:00 AM – 10:00 PM</span>
            <span>•</span>
            <Link to="/track" className="text-[#e6a832] hover:underline">
              Track Order ↗
            </Link>
          </div>
        </div>
      </div>

      {/* NAVIGATION BAR */}
      <nav
        className={`sticky top-0 z-50 flex items-center justify-between px-6 transition-all duration-300 sm:px-12 ${
          isScrolled
            ? "h-16 border-b border-[#c8860a]/20 bg-[#140e08]/92 shadow-2xl backdrop-blur-md"
            : "h-20 bg-transparent"
        }`}
      >
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#c8860a]/40 bg-[#2a1c0d] text-xl text-[#e6a832] shadow-sm">
            ☕
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-[#e6a832]">
            LDRN&apos;s Coffee
          </span>
        </Link>

        {/* Section Links */}
        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-[#b8a08a]">
          <li>
            <a href="#about" className="transition hover:text-[#f5e6d3]">
              About
            </a>
          </li>
          <li>
            <a href="#menu" className="transition hover:text-[#f5e6d3]">
              Highlights
            </a>
          </li>
          <li>
            <Link to="/browse" className="text-[#e6a832] font-semibold transition hover:text-[#f4c265]">
              Full Menu Catalog
            </Link>
          </li>
          <li>
            <a href="#reviews" className="transition hover:text-[#f5e6d3]">
              Reviews
            </a>
          </li>
        </ul>

        {/* Nav Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Audio Toggle Button */}
          <button
            onClick={toggleAudio}
            type="button"
            title="Play / Pause Cafe Background Music"
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              isPlaying
                ? "border-[#c8860a] bg-[#c8860a]/20 text-[#e6a832] shadow-[0_0_15px_rgba(200,134,10,0.3)] is-playing"
                : "border-[#c8860a]/30 bg-[#2a1c0d]/80 text-[#b8a08a] hover:border-[#c8860a] hover:text-[#f5e6d3]"
            }`}
          >
            <span className="eq-bars">
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
              <span className="eq-bar" />
            </span>
            <span className="hidden sm:inline">{isPlaying ? "Music: ON 🎵" : "Music: OFF"}</span>
          </button>

          {/* Direct Browse Catalog Link */}
          <Link
            to="/browse"
            className="hidden sm:inline-flex rounded-full border border-[#c8860a] px-4 py-1.5 text-xs font-semibold text-[#e6a832] transition hover:bg-[#c8860a] hover:text-[#140e08]"
          >
            Browse Menu
          </Link>

          {/* Primary Order Button */}
          <Link
            to="/order"
            className="rounded-full bg-[#c8860a] px-4 py-1.5 text-xs font-bold text-[#140e08] shadow-md transition hover:bg-[#e6a832] hover:shadow-[0_4px_20px_rgba(200,134,10,0.4)]"
          >
            Order Now
          </Link>

          {/* Staff Login / Portal Button */}
          {isAuthenticated ? (
            <Link
              to="/overview"
              className="rounded-full border border-[#c8860a]/40 bg-[#2a1c0d] px-3.5 py-1.5 text-xs font-semibold text-[#e6a832] hover:bg-[#342210]"
            >
              Workspace ({user?.first_name || "Staff"}) →
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-full border border-stone-700 bg-stone-900/60 px-3 py-1.5 text-xs font-medium text-[#b8a08a] hover:text-white"
            >
              Staff
            </Link>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden px-6 pt-16 pb-24 sm:px-12 sm:pt-24 sm:pb-32">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_70%_50%,rgba(200,134,10,0.12)_0%,transparent_70%)]" />
        
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center justify-between gap-12 lg:flex-row lg:gap-16">
          {/* Hero Left Content */}
          <div className="max-w-xl text-center lg:text-left animate-fade-up">
            <span className="inline-block rounded-full border border-[#c8860a]/30 bg-[#c8860a]/10 px-4 py-1.5 text-xs font-bold tracking-widest text-[#c8860a] uppercase">
              Est. 2020 · Artisan Coffee
            </span>
            <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Where Every Sip <br className="hidden sm:block" />
              <span className="text-[#e6a832]">Tells a Story</span>
            </h1>
            <p className="mt-6 text-base leading-relaxed text-[#b8a08a] sm:text-lg">
              Handcrafted coffee made with passion and precision. We source the finest single-origin beans and roast them fresh daily — so every cup is an experience worth savoring.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                to="/browse"
                className="flex items-center gap-2 rounded-full bg-[#c8860a] px-7 py-3.5 text-sm font-bold text-[#140e08] shadow-lg transition hover:bg-[#e6a832] hover:scale-105"
              >
                <span>Explore Full Menu</span>
                <span>→</span>
              </Link>
              <Link
                to="/order"
                className="rounded-full border border-[#f5e6d3]/40 bg-transparent px-7 py-3.5 text-sm font-semibold text-[#f5e6d3] transition hover:border-[#f5e6d3] hover:bg-[#f5e6d3]/10"
              >
                Order Online
              </Link>
              <a
                href="#reviews"
                className="flex items-center gap-1.5 text-xs font-bold text-[#e6a832] underline hover:text-[#f4c265] py-2 px-1 transition"
              >
                <span>⭐ 4.9 Customer Reviews</span>
              </a>
            </div>
          </div>

          {/* Hero Right Image with Golden Frame and Floating Badge */}
          <div className="relative flex-shrink-0 animate-fade-left">
            <div className="relative h-72 w-72 sm:h-96 sm:w-96">
              <img
                src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80"
                alt="Beautifully crafted latte art in a ceramic cup"
                className="h-full w-full rounded-full border-4 border-[#c8860a] object-cover shadow-[0_0_40px_rgba(200,134,10,0.25),0_10px_40px_rgba(0,0,0,0.6)]"
              />
              {/* Floating Customer Badge */}
              <div className="absolute -bottom-4 right-0 sm:right-2 rounded-2xl bg-[#c8860a] px-5 py-3 text-center text-[#140e08] shadow-[0_8px_25px_rgba(200,134,10,0.4)] animate-float-badge">
                <span className="block font-serif text-2xl font-bold leading-none">500+</span>
                <span className="text-[11px] font-bold tracking-tight">Happy Customers Daily</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center justify-center gap-2 text-xs text-[#b8a08a]">
          <span>Scroll to explore</span>
          <div className="h-3 w-3 rotate-45 border-r-2 border-b-2 border-[#c8860a] animate-scroll-bounce" />
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-[#c8860a]/20 bg-[#2a1c0d]/60 px-6 py-12 sm:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
          <div className="rounded-2xl p-4 text-center transition hover:bg-[#342210]">
            <span className="block font-serif text-3xl sm:text-4xl font-bold text-[#e6a832]">6+</span>
            <span className="mt-2 block text-xs sm:text-sm font-medium text-[#b8a08a]">Years of Craft</span>
          </div>
          <div className="rounded-2xl p-4 text-center transition hover:bg-[#342210]">
            <span className="block font-serif text-3xl sm:text-4xl font-bold text-[#e6a832]">30+</span>
            <span className="mt-2 block text-xs sm:text-sm font-medium text-[#b8a08a]">Signature Drinks</span>
          </div>
          <div className="rounded-2xl p-4 text-center transition hover:bg-[#342210]">
            <span className="block font-serif text-3xl sm:text-4xl font-bold text-[#e6a832]">500+</span>
            <span className="mt-2 block text-xs sm:text-sm font-medium text-[#b8a08a]">Cups Served Daily</span>
          </div>
          <div className="rounded-2xl p-4 text-center transition hover:bg-[#342210]">
            <span className="block font-serif text-3xl sm:text-4xl font-bold text-[#e6a832]">100%</span>
            <span className="mt-2 block text-xs sm:text-sm font-medium text-[#b8a08a]">Single-Origin Beans</span>
          </div>
        </div>
      </section>

      {/* ABOUT / STORY SECTION */}
      <section id="about" className="px-6 py-20 sm:px-12 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold tracking-widest text-[#c8860a] uppercase">Our Story</span>
          <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-bold text-white">Why LDRN&apos;s Coffee?</h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#b8a08a]">
            We believe great coffee is more than a drink — it is a ritual, a connection, and a moment of calm in a busy world.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="group overflow-hidden rounded-2xl border border-[#c8860a]/20 bg-[#2a1c0d] transition duration-300 hover:-translate-y-2 hover:border-[#c8860a]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="h-44 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&q=80"
                alt="Fresh coffee beans being roasted"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <span className="text-2xl">🌱</span>
              <h3 className="mt-3 font-serif text-lg font-bold text-white">Single-Origin Beans</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b8a08a]">
                We partner directly with small farms across Ethiopia, Colombia, and Benguet to bring you traceable, ethical coffee with distinct terroir in every cup.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group overflow-hidden rounded-2xl border border-[#c8860a]/20 bg-[#2a1c0d] transition duration-300 hover:-translate-y-2 hover:border-[#c8860a]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="h-44 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1521302200778-33500795e128?w=400&q=80"
                alt="Barista crafting latte art"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <span className="text-2xl">🏆</span>
              <h3 className="mt-3 font-serif text-lg font-bold text-white">Master Baristas</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b8a08a]">
                Our baristas train for months to perfect every pour, tamp, and temperature — because the difference between good and great coffee is in the details.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group overflow-hidden rounded-2xl border border-[#c8860a]/20 bg-[#2a1c0d] transition duration-300 hover:-translate-y-2 hover:border-[#c8860a]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="h-44 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&q=80"
                alt="Cozy coffee shop interior"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <span className="text-2xl">🏡</span>
              <h3 className="mt-3 font-serif text-lg font-bold text-white">A Space for Everyone</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b8a08a]">
                Whether you are catching up with friends, working remotely, or need a quiet corner with a great book — our doors are always open.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="group overflow-hidden rounded-2xl border border-[#c8860a]/20 bg-[#2a1c0d] transition duration-300 hover:-translate-y-2 hover:border-[#c8860a]/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="h-44 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=400&q=80"
                alt="Fresh pastries and coffee"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6">
              <span className="text-2xl">🥐</span>
              <h3 className="mt-3 font-serif text-lg font-bold text-white">Fresh Bakes Daily</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#b8a08a]">
                Pair your cup with our in-house baked goods — from flaky croissants to rich coffee cake — baked fresh every morning before sunrise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS / MENU SECTION */}
      <section id="menu" className="border-y border-[#c8860a]/20 bg-[#1e1509] px-6 py-20 sm:px-12 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
          {/* Menu Highlights List */}
          <div className="flex-1">
            <span className="text-xs font-bold tracking-widest text-[#c8860a] uppercase">Signature Highlights</span>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-bold text-white">
              Crafted with Passion,<br />
              <span className="text-[#e6a832]">Served with Care</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[#b8a08a]">
              From classic espresso pulls to seasonal cold brews and specialty drinks — every recipe is refined to bring out the very best of each bean.
            </p>

            <div className="mt-8 divide-y divide-dashed divide-[#c8860a]/20">
              <div className="flex items-center justify-between py-4 transition hover:pl-2">
                <div>
                  <h4 className="font-semibold text-white">Signature Espresso</h4>
                  <p className="text-xs text-[#b8a08a]">Rich, bold, and perfectly balanced</p>
                </div>
                <span className="font-serif text-lg font-bold text-[#e6a832]">₱95</span>
              </div>

              <div className="flex items-center justify-between py-4 transition hover:pl-2">
                <div>
                  <h4 className="font-semibold text-white">Creamy Cappuccino</h4>
                  <p className="text-xs text-[#b8a08a]">Velvety foam with a smooth finish</p>
                </div>
                <span className="font-serif text-lg font-bold text-[#e6a832]">₱120</span>
              </div>

              <div className="flex items-center justify-between py-4 transition hover:pl-2">
                <div>
                  <h4 className="font-semibold text-white">Cold Brew Special</h4>
                  <p className="text-xs text-[#b8a08a]">18-hour steep, silky and refreshing</p>
                </div>
                <span className="font-serif text-lg font-bold text-[#e6a832]">₱145</span>
              </div>

              <div className="flex items-center justify-between py-4 transition hover:pl-2">
                <div>
                  <h4 className="font-semibold text-white">Caramel Macchiato</h4>
                  <p className="text-xs text-[#b8a08a]">Sweet, layered, and indulgent</p>
                </div>
                <span className="font-serif text-lg font-bold text-[#e6a832]">₱135</span>
              </div>
            </div>

            {/* Prominent Browse & Order Actions */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/browse"
                className="flex items-center gap-2 rounded-full bg-[#c8860a] px-6 py-3 text-xs font-bold text-[#140e08] shadow-md transition hover:bg-[#e6a832]"
              >
                <span>Browse Full Menu Catalog</span>
                <span>→</span>
              </Link>
              <Link
                to="/order"
                className="rounded-full border border-[#c8860a]/40 bg-[#2a1c0d] px-5 py-3 text-xs font-semibold text-[#f5e6d3] transition hover:border-[#c8860a] hover:text-[#e6a832]"
              >
                Order Online
              </Link>
            </div>
          </div>

          {/* Menu Image with Staff Pick Badge */}
          <div className="relative flex-1">
            <div className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-[#c8860a]/30 shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&q=80"
                alt="Coffee barista preparing specialty drinks"
                className="h-full w-full object-cover transition duration-500 hover:scale-105"
              />
              <div className="absolute bottom-4 left-4 rounded-2xl border border-[#c8860a]/40 bg-[#140e08]/90 p-3.5 backdrop-blur-md">
                <span className="text-xs font-medium text-[#b8a08a]">🌟 Staff Pick</span>
                <p className="font-serif text-sm font-bold text-white">Signature Cold Brew</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS & COMMUNITY SECTION */}
      <section id="reviews" className="border-t border-[#c8860a]/20 bg-[#1e1509] px-6 py-20 sm:px-12 sm:py-28">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-xs font-bold tracking-widest text-[#c8860a] uppercase">
                Community Feedback &amp; Reviews
              </span>
              <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-bold text-white">
                Loved by Coffee Lovers,<br />
                <span className="text-[#e6a832]">Reviewed with Heart</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#b8a08a]">
                Read authentic feedback from daily commuters, remote creatives, and specialty connoisseurs who make LDRN&apos;s Coffee part of their daily ritual.
              </p>
            </div>

            {/* Aggregate Score Card */}
            <div className="flex items-center gap-4 rounded-3xl border border-[#c8860a]/30 bg-[#2a1c0d] p-5 shadow-xl shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c8860a] text-2xl font-serif font-black text-[#140e08]">
                4.9
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm text-[#e6a832]">
                  {"★".repeat(5)}
                </div>
                <p className="text-xs font-bold text-white mt-0.5">Over 1,200+ Verified Ratings</p>
                <span className="text-[11px] text-[#b8a08a]">Top-rated roastery cafe in Cebu</span>
              </div>
            </div>
          </div>

          {/* Reviews Grid & Review Form Container */}
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left 7 Columns: Existing Reviews Cards */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-white">
                  Recent Guest Reviews ({reviewsList.length})
                </h3>
                <span className="text-xs text-[#b8a08a] font-medium">Verified Experiences</span>
              </div>

              <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                {reviewsList.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-3xl border border-[#c8860a]/20 bg-[#2a1c0d] p-6 shadow-md transition duration-300 hover:border-[#c8860a]/50 hover:shadow-xl space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {rev.avatar ? (
                          <img
                            src={rev.avatar}
                            alt={rev.name}
                            className="h-10 w-10 rounded-full object-cover border border-[#c8860a]/40"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c8860a] font-bold text-xs text-[#140e08]">
                            {rev.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-white text-sm">{rev.name}</h4>
                          <span className="text-[11px] text-[#b8a08a]">{rev.role}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-[#e6a832]">
                          {"★".repeat(rev.rating)}
                          {"☆".repeat(5 - rev.rating)}
                        </div>
                        <span className="text-[10px] text-[#b8a08a]">{rev.date}</span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm leading-relaxed text-[#f5e6d3]/90 italic">
                      &ldquo;{rev.comment}&rdquo;
                    </p>

                    {rev.drink && (
                      <div className="pt-2 border-t border-[#c8860a]/10 flex items-center gap-1.5">
                        <span className="text-xs">☕</span>
                        <span className="text-[11px] font-semibold text-[#e6a832]">
                          Favorite Drink: <strong className="text-white">{rev.drink}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right 5 Columns: Interactive "Share Your Review" Card */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-[#c8860a]/30 bg-[#2a1c0d] p-7 shadow-2xl space-y-5 sticky top-24">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-[#c8860a] tracking-wider block">
                    Your Voice Matters
                  </span>
                  <h3 className="font-serif text-2xl font-bold text-white mt-1">Leave a Review</h3>
                  <p className="mt-1 text-xs text-[#b8a08a]">
                    Visited us recently? Share your thoughts on our coffee, vibe, or barista team.
                  </p>
                </div>

                {reviewSubmitted && (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-xs font-bold text-emerald-300 animate-in fade-in">
                    ✓ Thank you for your review! Your feedback was posted to our community board.
                  </div>
                )}

                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  {/* Star Rating Selector */}
                  <div>
                    <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider mb-1.5">
                      Your Rating
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          onMouseEnter={() => setReviewHoverRating(star)}
                          onMouseLeave={() => setReviewHoverRating(0)}
                          className="text-2xl transition hover:scale-125 focus:outline-none"
                        >
                          <span
                            className={
                              (reviewHoverRating || reviewRating) >= star
                                ? "text-[#e6a832]"
                                : "text-stone-700"
                            }
                          >
                            ★
                          </span>
                        </button>
                      ))}
                      <span className="ml-2 text-xs font-bold text-[#f5e6d3]">
                        {reviewRating === 5
                          ? "5.0 — Exceptional! ☕"
                          : reviewRating === 4
                          ? "4.0 — Great Experience"
                          : reviewRating === 3
                          ? "3.0 — Average"
                          : `${reviewRating}.0 — Needs Improvement`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maria Santos"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-2.5 text-xs text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">
                      Drink or Dish Enjoyed (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Artisan Spanish Latte / V60"
                      value={reviewDrink}
                      onChange={(e) => setReviewDrink(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-2.5 text-xs text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">
                      Review &amp; Thoughts *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Tell us what you loved about the brew, ambience, or service…"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-2.5 text-xs text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-[#c8860a] py-3 text-xs font-bold text-[#140e08] shadow-md transition hover:bg-[#e6a832] hover:scale-[1.01]"
                  >
                    Post Your Review ⭐
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Quick Visiting & Store Information Bar */}
          <div className="rounded-3xl border border-[#c8860a]/20 bg-[#2a1c0d]/60 p-6 sm:p-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c8860a]/20 text-sm">
                  📍
                </span>
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Roastery Location</h4>
                  <p className="text-[#b8a08a] mt-0.5">123 Unahan sa Amoa, Cebu City, Philippines</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c8860a]/20 text-sm">
                  🕐
                </span>
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Store Hours</h4>
                  <p className="text-[#b8a08a] mt-0.5">Open Daily: 5:00 AM – 10:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c8860a]/20 text-sm">
                  📧
                </span>
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Direct Inquiries</h4>
                  <p className="text-[#b8a08a] mt-0.5">hello@ldrncoffee.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#c8860a]/20 text-sm">
                  📞
                </span>
                <div>
                  <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">Phone Support</h4>
                  <p className="text-[#b8a08a] mt-0.5">+63 123 456 7890</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#c8860a]/20 bg-[#140e08] px-6 pt-16 pb-8 sm:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">☕</span>
              <span className="font-serif text-lg font-bold text-[#e6a832]">LDRN&apos;s Coffee</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#b8a08a]">
              Serving freshly roasted coffee and good vibes since 2020. Come for the coffee, stay for the community.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c8860a]/30 bg-[#2a1c0d] text-xs font-bold text-[#b8a08a] hover:bg-[#c8860a] hover:text-[#140e08] transition cursor-pointer">
                FB
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c8860a]/30 bg-[#2a1c0d] text-xs font-bold text-[#b8a08a] hover:bg-[#c8860a] hover:text-[#140e08] transition cursor-pointer">
                IG
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c8860a]/30 bg-[#2a1c0d] text-xs font-bold text-[#b8a08a] hover:bg-[#c8860a] hover:text-[#140e08] transition cursor-pointer">
                TK
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quick Navigation</h4>
            <ul className="mt-3 space-y-2 text-xs text-[#b8a08a]">
              <li>
                <a href="#about" className="hover:text-[#e6a832]">
                  About Us
                </a>
              </li>
              <li>
                <a href="#reviews" className="hover:text-[#e6a832]">
                  Customer Reviews ⭐
                </a>
              </li>
              <li>
                <Link to="/browse" className="hover:text-[#e6a832]">
                  Browse Menu Catalog
                </Link>
              </li>
              <li>
                <Link to="/order" className="hover:text-[#e6a832]">
                  Order Online
                </Link>
              </li>
              <li>
                <Link to="/track" className="hover:text-[#e6a832]">
                  Track My Order
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-[#e6a832]">
                  Staff Portal
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Roastery Offerings</h4>
            <ul className="mt-3 space-y-2 text-xs text-[#b8a08a]">
              <li>Single-Origin Espresso</li>
              <li>Slow-Drip Cold Brew</li>
              <li>Signature Lattes &amp; Mochas</li>
              <li>In-House Pastries &amp; Bakes</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Visit Us</h4>
            <p className="mt-3 text-xs text-[#b8a08a]">123 Unahan sa Amoa, Cebu City</p>
            <p className="mt-1 text-xs text-[#b8a08a]">
              Open Daily: <strong className="text-white">5:00 AM – 10:00 PM</strong>
            </p>
            <p className="mt-2 text-xs text-[#e6a832]">hello@ldrncoffee.com</p>
            <p className="text-xs text-[#b8a08a]">+63 123 456 7890</p>
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between border-t border-[#c8860a]/20 pt-6 text-xs text-[#b8a08a] sm:flex-row">
          <p>© 2026 LDRN&apos;s Coffee. All rights reserved.</p>
          <div className="mt-2 flex gap-4 sm:mt-0">
            <span className="hover:text-[#e6a832] cursor-pointer">Privacy Policy</span>
            <span>•</span>
            <span className="hover:text-[#e6a832] cursor-pointer">Terms of Service</span>
          </div>
        </div>
      </footer>

      {/* FLOATING MINI AUDIO PLAYER CONTROLLER */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-[#c8860a] bg-[#1a1108]/95 px-4 py-2 shadow-[0_10px_35px_rgba(0,0,0,0.7),0_0_20px_rgba(200,134,10,0.25)] backdrop-blur-md transition ${
          isPlaying ? "is-playing" : ""
        }`}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full bg-[radial-gradient(circle,#c8860a_0%,#160e07_70%)] text-xs text-[#140e08] shadow-sm ${
            isPlaying ? "animate-vinyl" : ""
          }`}
        >
          ☕
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-bold text-white leading-tight">LDRN Cafe Music</span>
          <span className="text-[10px] text-[#e6a832]">Background Lo-Fi</span>
        </div>
        <button
          onClick={toggleAudio}
          type="button"
          aria-label={isPlaying ? "Pause background music" : "Play background music"}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c8860a] text-xs font-bold text-[#140e08] transition hover:scale-110 hover:bg-[#e6a832]"
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title="Audio Volume"
          className="h-1.5 w-16 accent-[#e6a832] cursor-pointer"
        />
      </div>
    </div>
  );
}
