<script lang="ts">
	import { resolve } from '$app/paths';
	import './landing.css';

	const origin = 'https://vps.rahmanef.com';
	const canonical = `${origin}/landing`;
	const repository = 'https://github.com/rahmanef63/control-room';

	const features = [
		{
			icon: '>_',
			title: 'Persistent terminal sessions',
			copy: 'Close the browser and come back later. The host-side PTY keeps the process alive and reconnectable.'
		},
		{
			icon: '▦',
			title: 'Workspaces + multi-pane views',
			copy: 'Group shells by context, switch between focused and grid layouts, and keep many live sessions organized.'
		},
		{
			icon: '↻',
			title: 'Reconnect-first UX',
			copy: 'Reconnect buffers, stream state, terminal history, and restore flows are designed around interrupted browser sessions.'
		},
		{
			icon: '⌁',
			title: 'Desktop and mobile',
			copy: 'Dense desktop app chrome, safe-area-aware mobile layouts, soft terminal keys, fullscreen, and PWA installation.'
		},
		{
			icon: '◇',
			title: 'CLI-native by design',
			copy: 'Shell, SSH, Codex, Claude, Gemini, OpenClaw, or any normal CLI remain terminal processes—not a parallel orchestration layer.'
		},
		{
			icon: '●',
			title: 'Small security boundary',
			copy: 'The browser talks to SvelteKit; privileged PTY operations stay in a loopback-bound Node host agent.'
		}
	];

	const layers = [
		{ label: 'Browser / PWA', detail: 'Responsive terminal UI · HTTPS · SSE', tone: 'cyan' },
		{ label: 'SvelteKit frontend', detail: 'Auth boundary · server-side proxy · stream bridge', tone: 'violet' },
		{ label: 'Node 22 host agent', detail: 'Loopback-only · PTY lifecycle · bounded host helpers', tone: 'amber' },
		{ label: 'node-pty', detail: 'Shell · SSH · AI CLI · any terminal process', tone: 'green' }
	];

</script>

<svelte:head>
	<title>Control Room — Browser Terminal Multiplexer for Your VPS</title>
	<meta
		name="description"
		content="Control Room is a self-hosted browser and PWA terminal multiplexer: persistent PTYs, workspaces, reconnect, multi-pane views, and mobile terminal control."
	/>
	<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
	<meta name="theme-color" content="#07111f" />
	<link rel="canonical" href={canonical} />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Control Room" />
	<meta property="og:title" content="Control Room — Your terminal sessions, attached from anywhere." />
	<meta
		property="og:description"
		content="A self-hosted, terminal-first browser/PWA multiplexer with persistent PTYs, workspaces, reconnect, and mobile controls."
	/>
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={`${origin}/og-card.png`} />
	<meta property="og:image:width" content="2560" />
	<meta property="og:image:height" content="1600" />
	<meta property="og:image:alt" content="Control Room terminal workspace interface" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Control Room — Browser Terminal Multiplexer" />
	<meta
		name="twitter:description"
		content="Persistent PTYs, workspaces, reconnect, multi-pane views, and mobile terminal control in one self-hosted PWA."
	/>
	<meta name="twitter:image" content={`${origin}/og-card.png`} />
	<script type="application/ld+json">
		{
		  "@context": "https://schema.org",
		  "@type": "SoftwareApplication",
		  "name": "Control Room",
		  "url": "https://vps.rahmanef.com/landing",
		  "description": "A self-hosted browser and PWA terminal multiplexer for persistent PTY sessions, workspaces, reconnect, and mobile terminal control.",
		  "applicationCategory": "DeveloperApplication",
		  "operatingSystem": "Web Browser",
		  "softwareVersion": "2.0.0",
		  "isAccessibleForFree": true,
		  "license": "https://github.com/rahmanef63/control-room/blob/main/LICENSE",
		  "codeRepository": "https://github.com/rahmanef63/control-room",
		  "featureList": [
		    "Persistent terminal sessions",
		    "Workspaces and multi-pane views",
		    "Reconnect-first UX",
		    "Desktop and mobile PWA",
		    "CLI-native launch profiles",
		    "Loopback-bound host agent"
		  ]
		}
	</script>
</svelte:head>

<div class="landing">
	<a class="skip-link" href="#main-content">Skip to content</a>

	<header class="landing-nav">
		<a class="brand" href="#top" aria-label="Control Room landing page home">
			<span class="brand__icon" aria-hidden="true"><span>&gt;_</span></span>
			<span class="brand__copy"><strong>Control Room</strong><small>terminal multiplexer</small></span>
		</a>

		<nav class="landing-nav__links" aria-label="Landing page navigation">
			<a href="#features">Features</a>
			<a href="#architecture">Architecture</a>
			<a href="#interface">Interface</a>
		</nav>

		<div class="landing-nav__actions">
			<a class="nav-link nav-link--source" href={repository} rel="noreferrer">Source</a>
			<a class="nav-link nav-link--primary" href={resolve('/login')}>Open app <span aria-hidden="true">↗</span></a>
		</div>
	</header>

	<main id="main-content">
		<section id="top" class="hero section-shell">
			<div class="hero__copy">
				<div class="eyebrow"><span class="eyebrow__dot"></span> Self-hosted · terminal-first · PWA</div>
				<h1>Your terminal sessions,<br /><span>attached from anywhere.</span></h1>
				<p class="hero__lede">
					Control Room turns one machine into a browser-accessible terminal workspace: persistent PTYs,
					multi-pane sessions, reconnect, workspaces, and mobile controls—without turning the terminal into a
					control-plane platform.
				</p>

				<div class="hero__actions">
					<a class="button button--primary" href={resolve('/login')}>Open Control Room <span aria-hidden="true">→</span></a>
					<a class="button button--secondary" href={repository} rel="noreferrer">View source <span aria-hidden="true">↗</span></a>
				</div>

				<ul class="hero__facts" aria-label="Product highlights">
					<li><span>01</span> Browser + installed PWA</li>
					<li><span>02</span> Node 22 + node-pty</li>
					<li><span>03</span> Loopback-only agent</li>
				</ul>
			</div>

			<div class="hero__visual" aria-label="Animated illustration of the Control Room interface">
				<div class="visual-orbit visual-orbit--one"></div>
				<div class="visual-orbit visual-orbit--two"></div>
				<div class="browser-window">
					<div class="browser-window__top">
						<div class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
						<div class="browser-pill">vps.rahmanef.com</div>
						<span class="secure-pill">● live</span>
					</div>
					<div class="mock-menubar">
						<strong><span aria-hidden="true">&gt;_</span> Control Room</strong>
						<div><span>Terminal</span><span>View</span><span>Window</span></div>
						<small><i></i> 3 live</small>
					</div>
					<div class="mock-workspaces">
						<span class="is-active"><i></i> Default <b>2</b></span>
						<span><i></i> Production <b>1</b></span>
						<span><i></i> Research</span>
						<strong>+</strong>
					</div>
					<div class="mock-toolbar">
						<div class="mock-tabs">
							<span class="is-active"><i></i> shell <b>×</b></span>
							<span><i></i> codex <b>×</b></span>
						</div>
						<div class="mock-actions"><span>＋</span><span>▦</span><span>⌁</span><span>•••</span></div>
					</div>
					<div class="mock-terminal">
						<div class="mock-terminal__chrome">
							<span><i></i> shell</span>
							<small>~/projects/control-room</small>
							<b><i></i> 24ms</b>
						</div>
						<div class="terminal-lines" aria-hidden="true">
							<p><em>rahman@vps</em>:<strong>~/projects/control-room</strong>$ bun run verify</p>
							<p><span>✓</span> svelte-check <small>0 errors · 0 warnings</small></p>
							<p><span>✓</span> agent tests <small>35 passed</small></p>
							<p><span>✓</span> frontend tests <small>66 passed</small></p>
							<p><span>✓</span> playwright <small>responsive · a11y · terminal lifecycle</small></p>
							<p class="terminal-prompt"><em>rahman@vps</em>:<strong>~/projects/control-room</strong>$ <i></i></p>
						</div>
					</div>
				</div>

				<div class="floating-chip floating-chip--stream"><i></i><span><strong>Stream connected</strong><small>SSE + WS bridge</small></span></div>
				<div class="floating-chip floating-chip--pwa"><span aria-hidden="true">◇</span><span><strong>Installable</strong><small>desktop + mobile PWA</small></span></div>
			</div>
		</section>

		<section class="signal-strip" aria-label="Technical highlights">
			<div><span>Persistent PTY</span><small>detach browser, keep process</small></div>
			<div><span>Self-hosted</span><small>your host, your terminal state</small></div>
			<div><span>Mobile first</span><small>safe areas + soft terminal keys</small></div>
			<div><span>MIT licensed</span><small>source available on GitHub</small></div>
		</section>

		<section class="section-shell manifesto" aria-labelledby="manifesto-title">
			<div class="section-kicker">01 / Why</div>
			<div class="manifesto__grid">
				<h2 id="manifesto-title">tmux's persistence.<br />A browser's reach.</h2>
				<div>
					<p>
						The terminal is already the universal interface for developer tools. Control Room does not replace it—it
						makes terminal sessions easier to keep alive, organize, and reconnect to from the devices you already use.
					</p>
					<p class="manifesto__aside">Close the browser ≠ kill the process.</p>
				</div>
			</div>
		</section>

		<section id="features" class="section-shell features" aria-labelledby="features-title">
			<div class="section-heading">
				<div><div class="section-kicker">02 / Features</div><h2 id="features-title">Terminal workflow, not platform bloat.</h2></div>
				<p>Every surface exists to improve creating, organizing, reconnecting to, or interacting with terminal sessions.</p>
			</div>

			<div class="feature-grid">
				{#each features as feature, index (feature.title)}
					<article class="feature-card" style={`--index:${index}`}>
						<div class="feature-card__top"><span class="feature-icon" aria-hidden="true">{feature.icon}</span><small>0{index + 1}</small></div>
						<h3>{feature.title}</h3>
						<p>{feature.copy}</p>
						<span class="feature-card__arrow" aria-hidden="true">↗</span>
					</article>
				{/each}
			</div>
		</section>

		<section id="architecture" class="section-shell architecture" aria-labelledby="architecture-title">
			<div class="architecture__copy">
				<div class="section-kicker">03 / Architecture</div>
				<h2 id="architecture-title">A deliberately small trust boundary.</h2>
				<p>
					Browser JavaScript never owns the privileged host secret. SvelteKit authenticates and bridges requests;
					the host agent stays loopback-bound and owns PTY operations.
				</p>
				<ul>
					<li><span>✓</span> Human browser session and machine gateway secrets are separate.</li>
					<li><span>✓</span> Interactive shells do not inherit Control Room master secrets.</li>
					<li><span>✓</span> AI CLIs remain ordinary terminal processes with their own auth and tools.</li>
				</ul>
			</div>

			<div class="architecture-stack" aria-label="Control Room runtime architecture">
				{#each layers as layer, index (layer.label)}
					<div class="architecture-layer" data-tone={layer.tone} style={`--layer:${index}`}>
						<div><small>0{index + 1}</small><strong>{layer.label}</strong></div>
						<p>{layer.detail}</p>
						{#if index < layers.length - 1}<span class="architecture-connector" aria-hidden="true">↓</span>{/if}
					</div>
				{/each}
			</div>
		</section>

		<section id="interface" class="section-shell interface" aria-labelledby="interface-title">
			<div class="section-heading section-heading--interface">
				<div><div class="section-kicker">04 / Interface</div><h2 id="interface-title">Dense on desktop. Focused on mobile.</h2></div>
				<p>One terminal product, two interaction densities—without maintaining a second UI architecture.</p>
			</div>

			<div class="showcase-grid">
				<figure class="showcase-card showcase-card--desktop">
					<div class="showcase-card__label"><span>Desktop</span><small>multi-bar app chrome · dense terminal stage</small></div>
					<div class="showcase-image-wrap">
						<img src="/screenshot-wide.png" width="1440" height="900" loading="lazy" decoding="async" alt="Control Room desktop terminal workspace with menu bar, workspace rail, session toolbar, and terminal stage" />
					</div>
				</figure>
				<figure class="showcase-card showcase-card--mobile">
					<div class="showcase-card__label"><span>Mobile</span><small>swipe rails · safe-area · action sheets</small></div>
					<div class="showcase-image-wrap">
						<img src="/screenshot-narrow.png" width="430" height="900" loading="lazy" decoding="async" alt="Control Room mobile terminal workspace with compact navigation and terminal controls" />
					</div>
				</figure>
			</div>
		</section>

		<section class="section-shell principles" aria-labelledby="principles-title">
			<div class="section-kicker">05 / Product rule</div>
			<div class="principles__grid">
				<div>
					<h2 id="principles-title">The terminal stays the product.</h2>
					<p>Control Room deliberately stops before becoming a generic operations dashboard.</p>
				</div>
				<div class="principle-list">
					<div><span>Not a</span><strong>credential manager</strong></div>
					<div><span>Not a</span><strong>browser automation engine</strong></div>
					<div><span>Not a</span><strong>cron / job orchestrator</strong></div>
					<div><span>Not a</span><strong>deployment platform</strong></div>
					<div class="is-positive"><span>It is</span><strong>a better way to attach to terminals</strong></div>
				</div>
			</div>
		</section>

		<section class="final-cta section-shell" aria-labelledby="cta-title">
			<div class="final-cta__glow"></div>
			<div class="final-cta__inner">
				<div class="section-kicker">Ready when the shell is.</div>
				<h2 id="cta-title">One host. Your sessions.<br /><span>Any screen.</span></h2>
				<p>Keep the terminal. Upgrade the way you attach to it.</p>
				<div class="hero__actions hero__actions--center">
					<a class="button button--primary" href={resolve('/login')}>Enter Control Room <span aria-hidden="true">→</span></a>
					<a class="button button--secondary" href={repository} rel="noreferrer">Explore the code <span aria-hidden="true">↗</span></a>
				</div>
			</div>
		</section>
	</main>

	<footer class="landing-footer section-shell">
		<div class="brand brand--footer"><span class="brand__icon" aria-hidden="true"><span>&gt;_</span></span><span class="brand__copy"><strong>Control Room</strong><small>v2.0.0</small></span></div>
		<p>A browser/mobile terminal multiplexer for one machine.</p>
		<div><a href={repository} rel="noreferrer">GitHub ↗</a><a href={resolve('/login')}>Sign in ↗</a></div>
	</footer>
</div>
