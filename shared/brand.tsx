export default function Brand({ light = false }: {
    light?: boolean;
}) { return <span className={`brand ${light ? 'light' : ''}`}><span className="brand-symbol">K<span>✦</span></span><span>KINGA ASILI<small>THE ART OF EVERYDAY CARE</small></span></span>; }
