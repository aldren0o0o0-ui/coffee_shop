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
  const [formStatus, setFormStatus] = useState("idle"); // idle | sent
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

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

  function handleFormSubmit(e) {
    e.preventDefault();
    setFormStatus("sent");
    setTimeout(() => {
      setFormData({ name: "", email: "", subject: "", message: "" });
      setFormStatus("idle");
    }, 4000);
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
            <a href="#contact" className="transition hover:text-[#f5e6d3]">
              Contact
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
                href="#contact"
                className="text-xs font-semibold text-[#e6a832] underline hover:text-[#f4c265] py-2 px-1"
              >
                Reserve a Table
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

      {/* CONTACT & RESERVATION SECTION */}
      <section id="contact" className="border-t border-[#c8860a]/20 bg-[#1e1509] px-6 py-20 sm:px-12 sm:py-28">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Contact Details */}
          <div className="flex-1">
            <span className="text-xs font-bold tracking-widest text-[#c8860a] uppercase">Get in Touch</span>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-bold text-white">We Would Love to Hear from You</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#b8a08a]">
              Have a question, a reservation request, or just want to say hi? Drop us a message and we will get back to you as soon as the espresso is done brewing.
            </p>

            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c8860a]/30 bg-[#2a1c0d] text-lg">
                  📍
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Visit Us</h4>
                  <p className="text-sm text-[#b8a08a]">123 Unahan sa Amoa, Cebu City, Philippines</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c8860a]/30 bg-[#2a1c0d] text-lg">
                  🕐
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Opening Hours</h4>
                  <p className="text-sm text-[#b8a08a]">Open Daily: 5:00 AM – 10:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c8860a]/30 bg-[#2a1c0d] text-lg">
                  📧
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Email Us</h4>
                  <p className="text-sm text-[#b8a08a]">hello@ldrncoffee.com</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#c8860a]/30 bg-[#2a1c0d] text-lg">
                  📞
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Call Us</h4>
                  <p className="text-sm text-[#b8a08a]">+63 123 456 7890</p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Contact Form */}
          <div className="flex-1 rounded-3xl border border-[#c8860a]/20 bg-[#2a1c0d] p-8 shadow-2xl">
            <h3 className="font-serif text-2xl font-bold text-white">Send Us a Message</h3>
            <p className="mt-1 text-xs text-[#b8a08a]">We respond to all table reservations and inquiries daily.</p>

            <form onSubmit={handleFormSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Juan dela Cruz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-3 text-sm text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-3 text-sm text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Table reservation for 2"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-3 text-sm text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#b8a08a] uppercase tracking-wider">Message</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tell us how we can help…"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-[#c8860a]/30 bg-[#140e08] px-4 py-3 text-sm text-[#f5e6d3] outline-none transition placeholder:text-[#b8a08a]/50 focus:border-[#c8860a] focus:ring-2 focus:ring-[#c8860a]/20"
                />
              </div>

              <button
                type="submit"
                disabled={formStatus === "sent"}
                className={`w-full rounded-full py-3.5 text-xs font-bold tracking-wider uppercase transition duration-200 ${
                  formStatus === "sent"
                    ? "bg-emerald-600 text-white"
                    : "bg-[#c8860a] text-[#140e08] hover:bg-[#e6a832] shadow-md hover:scale-[1.01]"
                }`}
              >
                {formStatus === "sent" ? "Message Sent! ✅" : "Send Message ✉️"}
              </button>
            </form>
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
