'use client';
import { useCallback, useEffect, useState } from "react";
import {useDialog} from "@shared/use-dialog";
import {eatDate,type Product,type RecordRow} from "@shared/domain";
import {storefrontPath} from "@/lib/urls";
import {catalogueBlends,catalogueChoices,requestLines,type CartItem} from "@/lib/catalogue";

type Blend = "GLT" | "GOT";

type CustomerDetails = {
  name: string;
  phone: string;
  location: string;
  notes: string;
};


function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M14 6l6 6-6 6" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.8 8h10.4l1 12H5.8l1-12Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  );
}

function LeafMark({ light = false }: { light?: boolean }) {
  return (
    <span className={`leaf-mark ${light ? "light" : ""}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Storefront() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [products,setProducts]=useState<Product[]>([]),[bundles,setBundles]=useState<RecordRow[]>([]),[catalogueError,setCatalogueError]=useState(''),[loading,setLoading]=useState(true),[submitting,setSubmitting]=useState(false),[reference,setReference]=useState(''),[deliveryDate,setDeliveryDate]=useState(eatDate()),[requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  const loadCatalogue=useCallback(async(quiet=false)=>{if(!quiet)setLoading(true);setCatalogueError('');try{const response=await fetch(storefrontPath('api/catalogue'),{cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error);setProducts(result.products);setBundles(result.bundles);}catch(error){setCatalogueError((error as Error).message);}finally{setLoading(false);}},[]);
  useEffect(()=>{void loadCatalogue();const refresh=()=>{if(document.visibilityState==='visible')void loadCatalogue(true);};const timer=window.setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[loadCatalogue]);
  const blends=catalogueBlends(products);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<CustomerDetails>({
    name: "",
    phone: "",
    location: "",
    notes: "",
  });
  const [detailsError, setDetailsError] = useState("");
  const [selectedSizes, setSelectedSizes] = useState<Record<Blend, number>>({
    GLT: 0,
    GOT: 0,
  });

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const closeCart=useCallback(()=>{if(!submitting)setCartOpen(false);},[submitting]);
  useDialog(cartOpen,closeCart);
  function addToCart(blend:Blend){
    const choices=catalogueChoices(products,bundles,blend);const choice=choices[selectedSizes[blend]]||choices[0];if(!choice)return;
    if(reference){setReference('');setRequestKey(crypto.randomUUID());}
    setCart(current=>{const match=current.find(item=>item.key===choice.key);return match?current.map(item=>item.key===choice.key?{...item,quantity:item.quantity+1}:item):[...current,{...choice,blend,size:choice.label,quantity:1}];});setCartOpen(true);setDetailsError('');
  }

  function changeQuantity(index: number, amount: number) {
    setCart((current) =>
      current
        .map((item, i) =>
          i === index ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function scrollToShop() {
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  }

  function updateCustomer(field: keyof CustomerDetails, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    if (detailsError) setDetailsError("");
  }

  async function submitOrder(){
    if(submitting)return;setDetailsError('');
    const phone=customer.phone.replace(/\D/g,'');
    if(customer.name.trim().length<2||customer.name.length>120||! /^[+\d\s().-]+$/.test(customer.phone)||! /^(?:0[17]\d{8}|254[17]\d{8})$/.test(phone)||customer.location.trim().length<2||customer.location.length>500||customer.notes.length>2000){setDetailsError('Enter your name, a valid Kenyan mobile number and delivery address.');return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)||deliveryDate<eatDate()||deliveryDate>eatDate(new Date(Date.now()+60*86400000))){setDetailsError('Choose a delivery date within the next 60 days.');return;}
    setSubmitting(true);try{const response=await fetch(storefrontPath('api/requests'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:customer.name.trim(),phone,location:customer.location.trim(),notes:customer.notes.trim(),delivery_date:deliveryDate,idempotency_key:requestKey,lines:requestLines(cart)})});const result=await response.json();if(!response.ok)throw Error(result.error);setReference(result.reference);setCart([]);}catch(error){setDetailsError((error as Error).message);}finally{setSubmitting(false);}
  }

  return (
    <main>
      <header className="site-header">
        <button
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
        </button>
        <a className="wordmark" href="#top" aria-label="Kinga Asili home">
          <LeafMark />
          <span>Kinga Asili</span>
          <small>Nature in every pour</small>
        </a>
        <div className="header-actions">
          <a className="staff-login" href="/login" aria-label="Staff login">Login</a>
          <button className="cart-button" onClick={() => setCartOpen(true)}>
            <BagIcon />
            <span>Bag</span>
            <b>{cartCount}</b>
          </button>
        </div>
        <nav className={menuOpen ? "nav open" : "nav"}>
          <a href="#story" onClick={() => setMenuOpen(false)}>
            Our story
          </a>
          <a href="#shop" onClick={() => setMenuOpen(false)}>
            Shop blends
          </a>
          <a href="#ritual" onClick={() => setMenuOpen(false)}>
            The ritual
          </a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>
            Contact
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Cold-pressed in Nairobi</p>
          <h1>
            Care for your
            <br />
            everyday <em>self.</em>
          </h1>
          <p className="hero-intro">
            Vibrant ginger, sun-bright citrus and golden turmeric—thoughtfully blended into a small,
            powerful daily ritual.
          </p>
          <button className="text-link" onClick={scrollToShop}>
            Find your blend <ArrowIcon />
          </button>
        </div>
        <div className="hero-visual">
          <img
            src="https://images.unsplash.com/photo-1606486746458-e44951581ade?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1600"
            alt="Fresh lemon and ginger ingredients arranged on a wooden board"
          />
          <div className="sun-orbit" />
          <p className="photo-note">Ginger / citrus / turmeric</p>
        </div>
        <div className="hero-stamp">
          <span>100%</span>
          <small>natural ingredients</small>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div>
          <span>NO PRESERVATIVES</span>
          <i>✦</i>
          <span>MADE IN NAIROBI</span>
          <i>✦</i>
          <span>COLD-PRESSED</span>
          <i>✦</i>
          <span>SMALL-BATCH CARE</span>
          <i>✦</i>
          <span>NO PRESERVATIVES</span>
        </div>
      </div>

      <section className="story" id="story">
        <p className="section-number">01 / OUR PHILOSOPHY</p>
        <div className="story-heading">
          <LeafMark />
          <h2>
            Wellness isn’t a grand gesture.
            <br />
            It’s what you choose, <em>every day.</em>
          </h2>
        </div>
        <div className="story-grid">
          <figure>
            <img
              src="https://images.unsplash.com/photo-1631029098074-be99eb2b425c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000"
              alt="A golden citrus drink in a clear glass"
            />
          </figure>
          <div>
            <p>
              Kinga Asili means “protect nature.” For us, that begins with protecting your own
              nature—the energy, ease and balance that carries you through each day.
            </p>
            <p>
              We press familiar ingredients with care, keeping every blend honest, fresh and close
              to its source. Nothing complicated. Nothing hidden.
            </p>
            <a href="#ritual" className="text-link">
              Why cold-pressed? <ArrowIcon />
            </a>
          </div>
        </div>
      </section>

      <section className="shop" id="shop">
        <div className="shop-heading">
          <div>
            <p className="section-number">02 / THE BLENDS</p>
            <h2>Pick your daily ritual.</h2>
          </div>
          <p>Choose your blend, bottle size or an available pack.</p>
        </div>
        {catalogueError&&<div className="catalogue-message" role="alert">{catalogueError} <button onClick={()=>void loadCatalogue()}>Retry</button> <a href="https://wa.me/254712866898">Contact Kinga</a></div>}
        {!loading&&!catalogueError&&!blends.length&&<p className="catalogue-message">Our catalogue is being prepared. Please check back soon or contact Kinga.</p>}
        <div className="product-grid">
          {blends.map((blend, blendIndex) => {
            const sizes=catalogueChoices(products,bundles,blend.id);
            const selected = sizes[selectedSizes[blend.id]]||sizes[0];
            const product=blend.variants.find(variant=>variant.id===selected?.product_id)||blend.variants[0];
            return (
              <article className="product-card" key={blend.id}>
                <div className="product-image">
                  <img src={product.image} alt={product.name} />
                  <span className="product-index">0{blendIndex + 1}</span>
                </div>
                <div className="product-info">
                  <p className="product-note">{product.note}</p>
                  <h3>{blend.id}</h3>
                  <p className="ingredients">{product.name}</p>
                  <p className="description">{product.description}</p>
                  <div className="size-picker">
                    {sizes.map((size, index) => (
                      <button
                        key={size.label}
                        className={selectedSizes[blend.id] === index ? "selected" : ""}
                        onClick={() =>
                          setSelectedSizes((current) => ({
                            ...current,
                            [blend.id]: index,
                          }))
                        }
                      >
                        <span>{size.label}</span>
                        <small>{size.sub}</small>
                      </button>
                    ))}
                  </div>
                  <button className="add-button" disabled={!selected||loading} onClick={() => addToCart(blend.id)}>
                    <span>{loading?"Loading…":selected?"Add to bag":"Currently unavailable"}</span>
                    <b>{selected?`KES ${selected.price.toLocaleString()}`:""}</b>
                    <ArrowIcon />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="ritual" id="ritual">
        <div className="ritual-image">
          <img
            src="https://images.unsplash.com/photo-1616442047042-f54e9f6bd435?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1400"
            alt="Lemon and a natural drink on a sunlit table"
          />
          <span>From the earth, for your everyday</span>
        </div>
        <div className="ritual-copy">
          <p className="section-number">03 / MAKE IT A RITUAL</p>
          <h2>
            Small pour.
            <br />
            Big intention.
          </h2>
          <p>
            Shake well. Pour cold. Take a breath. Our blends are made to slip into the life you
            already live—before the commute, after a workout, or whenever you need a bright little
            reset.
          </p>
          <div className="ritual-steps">
            <div>
              <b>01</b>
              <span>Keep chilled</span>
            </div>
            <div>
              <b>02</b>
              <span>Shake it up</span>
            </div>
            <div>
              <b>03</b>
              <span>Pour & pause</span>
            </div>
          </div>
        </div>
      </section>

      <section className="order-banner" id="contact">
        <div>
          <LeafMark light />
          <p className="eyebrow">Personal ordering, just as it should be</p>
          <h2>
            Let’s prepare
            <br />
            your next pour.
          </h2>
        </div>
        <div>
          <p>
            Choose your blend, size and quantity, then send a request. We’ll confirm availability, delivery fees and payment details.
          </p>
          <button className="light-button" onClick={scrollToShop}>
            Shop the blends <ArrowIcon />
          </button>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <a className="wordmark light-wordmark" href="#top">
            <LeafMark light />
            <span>Kinga Asili</span>
            <small>Nature in every pour</small>
          </a>
          <p>The art of everyday care.</p>
        </div>
        <div className="footer-links">
          <div>
            <small>Explore</small>
            <a href="#story">Our story</a>
            <a href="#shop">Shop blends</a>
            <a href="#ritual">The ritual</a>
            <a href="/login">Staff login</a>
          </div>
          <div>
            <small>Say hello</small>
            <a href="https://www.instagram.com/kingaasili/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://wa.me/254712866898" target="_blank" rel="noreferrer">
              Contact the team
            </a>
            <a href="https://wa.me/254712866898" target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>
          <div>
            <small>Made with care</small>
            <p>Nairobi, Kenya</p>
            <p>Mon–Sat, 8am–6pm</p>
          </div>
        </div>
        <p className="copyright">© {new Date().getFullYear()} KINGA ASILI · KEEP REFRIGERATED</p>
      </footer>

      <div
        className={cartOpen ? "drawer-overlay open" : "drawer-overlay"}
        onClick={closeCart}
        aria-hidden="true"
      />
      <aside className={cartOpen ? "cart-drawer open" : "cart-drawer"} role="dialog" aria-modal={cartOpen||undefined} aria-labelledby="cart-title" aria-hidden={!cartOpen} inert={!cartOpen}>
        <div className="drawer-header">
          <div>
            <p className="section-number">YOUR ORDER</p>
            <h2 id="cart-title">Daily care, bottled.</h2>
          </div>
          <button onClick={closeCart} disabled={submitting} aria-label="Close bag">
            ×
          </button>
        </div>
        {reference?(<div className="request-confirmation" role="status"><LeafMark/><h3>Your request is with us.</h3><p>Reference <strong>{reference}</strong></p><p>The team will confirm availability, delivery fees and payment details before packing.</p><a className="text-link" href={`https://wa.me/254712866898?text=${encodeURIComponent('Hello Kinga! I am following up on request '+reference)}`} target="_blank" rel="noreferrer">Contact Kinga on WhatsApp <ArrowIcon/></a><button className="dark-button" onClick={()=>{setReference('');setRequestKey(crypto.randomUUID());setCartOpen(false);scrollToShop();}}>Keep exploring <ArrowIcon/></button></div>):cart.length === 0 ? (
          <div className="empty-cart">
            <LeafMark />
            <p>Your bag is waiting for something bright.</p>
            <button
              className="dark-button"
              onClick={() => {
                setCartOpen(false);
                scrollToShop();
              }}
            >
              Explore blends <ArrowIcon />
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map((item, index) => (
                <div className="cart-item" key={item.key}>
                  <div className={`mini-bottle ${item.blend.toLowerCase()}`}>
                    <b>{item.blend}</b>
                  </div>
                  <div className="cart-item-copy">
                    <h3>{item.blend}</h3>
                    <p>{item.size}</p>
                    <div className="quantity">
                      <button disabled={submitting} aria-label={`Remove one ${item.blend} ${item.size}`} onClick={() => changeQuantity(index, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button disabled={submitting} aria-label={`Add one ${item.blend} ${item.size}`} onClick={() => changeQuantity(index, 1)}>+</button>
                    </div>
                  </div>
                  <b>KES {(item.price * item.quantity).toLocaleString()}</b>
                </div>
              ))}
              <div className="customer-details">
                <div className="customer-details-heading">
                  <p className="section-number">YOUR DETAILS</p>
                  <p>So we can confirm and coordinate your delivery.</p>
                </div>
                <div className="field-row">
                  <label>
                    <span>Full name *</span>
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(event) => updateCustomer("name", event.target.value)}
                      maxLength={120}
                      disabled={submitting}
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </label>
                  <label>
                    <span>Phone number *</span>
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(event) => updateCustomer("phone", event.target.value)}
                      maxLength={20}
                      disabled={submitting}
                      autoComplete="tel"
                      placeholder="+254..."
                    />
                  </label>
                </div>
                <label>
                  <span>Delivery location *</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    disabled={submitting}
                    value={customer.location}
                    onChange={(event) => updateCustomer("location", event.target.value)}
                    autoComplete="street-address"
                    placeholder="Area, estate or landmark"
                  />
                </label>
                <label>
                  <span>Order notes</span>
                  <textarea
                    maxLength={2000}
                    disabled={submitting}
                    value={customer.notes}
                    onChange={(event) => updateCustomer("notes", event.target.value)}
                    placeholder="Preferred delivery time or anything else"
                    rows={2}
                  />
                </label>
                <label><span>Preferred delivery date *</span><input type="date" min={eatDate()} max={eatDate(new Date(Date.now()+60*86400000))} value={deliveryDate} disabled={submitting} onChange={event=>setDeliveryDate(event.target.value)}/></label>
                {detailsError && (
                  <p className="details-error" role="alert">
                    {detailsError}
                  </p>
                )}
              </div>
            </div>
            <div className="drawer-footer">
              <div className="total">
                <span>Estimated total</span>
                <b>KES {cartTotal.toLocaleString()}</b>
              </div>
              <p>Delivery fee confirmed separately based on your location.</p>
              <button className="whatsapp-button" disabled={submitting} onClick={()=>void submitOrder()}>
                {submitting?"Sending request…":"Send order request"} <ArrowIcon />
              </button>
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
