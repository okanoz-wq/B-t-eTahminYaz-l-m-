import { Chart } from 'chart.js/auto';

let applied = false;

export function applyChartDefaults() {
  if (applied) return;
  applied = true;
  Chart.defaults.color = '#8b96a8';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#1a2230';
  Chart.defaults.plugins.tooltip.titleColor = '#e8ecf2';
  Chart.defaults.plugins.tooltip.bodyColor = '#8b96a8';
  Chart.defaults.plugins.tooltip.borderColor = '#303c52';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12.5 };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.animation.duration = 1200;
  Chart.defaults.animation.easing = 'easeOutQuart';
}

export function chartGradient(ctx, chartArea, colorTop, colorBottom) {
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  return gradient;
}

export { Chart };
