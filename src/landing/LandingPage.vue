<script setup lang="ts">
import BenchmarksSection from './BenchmarksSection.vue';
import CtaSection from './CtaSection.vue';
import EnginesSection from './EnginesSection.vue';
import FaqSection from './FaqSection.vue';
import FeaturesSection from './FeaturesSection.vue';
import HeroSection from './HeroSection.vue';
import PrivacySection from './PrivacySection.vue';
import SafetySection from './SafetySection.vue';
import SiteFooter from './SiteFooter.vue';
import SiteHeader from './SiteHeader.vue';
import StartSection from './StartSection.vue';
</script>

<template>
  <a class="skip" href="#main">Skip to content</a>
  <SiteHeader />
  <main id="main">
    <HeroSection />
    <FeaturesSection />
    <BenchmarksSection />
    <EnginesSection />
    <SafetySection />
    <PrivacySection />
    <StartSection />
    <FaqSection />
    <CtaSection />
  </main>
  <SiteFooter />
</template>
