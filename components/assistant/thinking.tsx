'use client';
import {useEffect,useState} from 'react';
/** KooKoo's dots and elapsed time, without inventing tool progress. */
export default function Thinking({label='Preparing your answer'}:{label?:string}) {
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);return()=>window.clearInterval(timer);},[]);
 return <div className="kai-think" role="status"><p className="kai-think__now"><span className="kai-think__dots" aria-hidden="true"><i/><i/><i/></span><span>{label}…</span>{seconds>=4&&<span className="kai-think__time">{seconds}s</span>}</p></div>;
}
