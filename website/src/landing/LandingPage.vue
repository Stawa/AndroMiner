<script setup lang="ts">
import BenchmarksSection from './BenchmarksSection.vue';
import CtaSection from './CtaSection.vue';
import DownloadSection from './DownloadSection.vue';
import EnginesSection from './EnginesSection.vue';
import FaqSection from './FaqSection.vue';
import FeaturesSection from './FeaturesSection.vue';
import HeroSection from './HeroSection.vue';
import PrivacySection from './PrivacySection.vue';
import SafetySection from './SafetySection.vue';
import SiteFooter from '../site/SiteFooter.vue';
import SiteHeader from '../site/SiteHeader.vue';
import ShowcaseSection from './ShowcaseSection.vue';
import StartSection from './StartSection.vue';
</script>

<template>
  <a
    class="absolute top-[-100px] left-gutter z-30 bg-accent px-4 py-2.5 font-bold text-on-accent focus:top-3"
    href="#main"
    >Skip to content</a
  >
  <SiteHeader />
  <main id="main" class="[&>section]:px-(--page-pad) [&>section+section]:mt-section">
    <HeroSection />
    <FeaturesSection />
    <ShowcaseSection />
    <StartSection />
    <DownloadSection />
    <SafetySection />
    <BenchmarksSection />
    <EnginesSection />
    <PrivacySection />
    <FaqSection />
    <CtaSection />
  </main>
  <SiteFooter />
</template>
