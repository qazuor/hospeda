/**
 * @file hero.ts
 * @description Static image data for the hero section slideshow.
 * Images are imported from src/assets/hero/ for Astro image optimization.
 */
import hero1 from '@/assets/hero/hero-1.jpg';
import hero2 from '@/assets/hero/hero-2.jpg';
import hero3 from '@/assets/hero/hero-3.jpg';
import hero4 from '@/assets/hero/hero-4.jpg';
import hero5 from '@/assets/hero/hero-5.png';
import hero6 from '@/assets/hero/hero-6.png';
import hero7 from '@/assets/hero/hero-7.jpg';
import hero8 from '@/assets/hero/hero-8.jpg';
import hero9 from '@/assets/hero/hero-9.jpg';
import hero10 from '@/assets/hero/hero-10.jpg';
import hero11 from '@/assets/hero/hero-11.png';
import hero12 from '@/assets/hero/hero-12.jpg';
import hero13 from '@/assets/hero/hero-13.jpg';
import hero14 from '@/assets/hero/hero-14.jpg';
import hero15 from '@/assets/hero/hero-15.jpg';
import hero16 from '@/assets/hero/hero-16.jpeg';

/** Duration in seconds each slide is visible */
export const SLIDE_SECONDS = 6 as const;

/**
 * Raw hero image definitions with ESM imports.
 * These are processed by Astro's getImage() in HeroSection.astro
 * to generate optimized URLs.
 */
export const HERO_IMAGE_SOURCES = [
    { src: hero1, alt: 'Vista panoramica del Rio Uruguay en Entre Rios' },
    { src: hero2, alt: 'Atardecer sobre el Rio Uruguay' },
    { src: hero3, alt: 'Playa de arena blanca en Colon' },
    { src: hero4, alt: 'Termas de aguas calientes en Concordia' },
    { src: hero5, alt: 'Ciudad costera del litoral entrerriano' },
    { src: hero6, alt: 'Amanecer con neblina sobre el rio' },
    { src: hero7, alt: 'Paisaje costero del litoral' },
    { src: hero8, alt: 'Naturaleza entrerriana' },
    { src: hero9, alt: 'Rio Uruguay al atardecer' },
    { src: hero10, alt: 'Costa del Rio Uruguay' },
    { src: hero11, alt: 'Vegetacion del litoral' },
    { src: hero12, alt: 'Playa entrerriana' },
    { src: hero13, alt: 'Paisaje del litoral argentino' },
    { src: hero14, alt: 'Atardecer en Entre Rios' },
    { src: hero15, alt: 'Naturaleza del litoral' },
    { src: hero16, alt: 'Costa entrerriana' }
] as const;
