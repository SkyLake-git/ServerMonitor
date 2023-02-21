import protocol, { ping } from 'bedrock-protocol'
import { ServerAdvertisement } from 'bedrock-protocol'
import colors from 'colors'
import fs from 'fs'

type Config = {
	addresses: {
		host: string,
		port: number
	}[]
	ping_rate: number,
	render_rate: number
	global_event_lifetime: number,
	server_event_lifetime: number
}

const DefaultConfig: Config = {
	addresses: [],
	ping_rate: 1000 * 20,
	render_rate: 1000 * 0.05,
	global_event_lifetime: 1000 * 30,
	server_event_lifetime: 1000 * 200
}


function readConfigFile(fn: string): any {
	let needCreate = !fs.existsSync(fn)
	if (needCreate) {
		fs.writeFileSync(fn, JSON.stringify(DefaultConfig, undefined, 4), { encoding: "utf-8" })
	}

	let content = JSON.parse(fs.readFileSync(fn, { encoding: "utf-8" }))

	return content
}

function loadConfig(fn: string): Config {
	let content = readConfigFile(fn)

	return content
}

const config = loadConfig('./cfg.json')

class Event {
	text: string
	life: number
	created_at: number

	static player_diff(diff: number): Event {
		let base = `Player ${diff > 0 ? 'joined' : 'left'} x${Math.abs(diff)}`
		return new Event(diff > 0 ? colors.dim(colors.green(base)) : colors.dim(colors.red(base)))
	}

	static ping_failure(host: string, port: number): Event {
		let base = `Ping failed to ${host}:${port}`
		return new Event(colors.red(base))
	}

	constructor(text: string, lifetime: number = -2) {
		this.text = text
		this.life = lifetime
		this.created_at = new Date().getTime()
	}

	getText(): string {
		return this.text
	}

	getLifeTime(): number {
		return this.life
	}

	getCreatedAt(): number {
		return this.created_at
	}

	getDuration(): number {
		return new Date().getTime() - this.created_at
	}
}

class EventRenderer {

	events: Map<number, Event>
	#next_id: number
	#rendering_id: number
	#base_lifetime: number

	constructor(baseLifetime: number) {
		this.events = new Map()
		this.#next_id = 0
		this.#rendering_id = -1
		this.#base_lifetime = baseLifetime
	}

	add(event: Event): void {
		if (event.getLifeTime() == -2) {
			event.life = this.#base_lifetime
		}

		this.events.set(this.#next_id ++, event)
	}

	tick(): void {
		for (let vSet of this.events) {
			let id = vSet[0]
			let event = vSet[1]
			if (event.getDuration() > event.getLifeTime() && event.getLifeTime() > 0) {
				this.events.delete(id)
			}
		}
	}

	render(): void {
		for (let event of Array.from(this.events.values()).reverse()) {
			this._renderNext(event)
		}
	}

	_renderNext(event: Event): void {
		console.log(`${event.getText()}` + colors.gray(` - `) + colors.gray(`${(event.getDuration() / 1000).toFixed(1)} seconds ago`))
	}
}

type AdvertisementUpdateStatus = 'refresh' | 'error' | 'none'

class ServerAdvertisementRenderer {

	ad: ServerAdvertisement | null
	lastAd: ServerAdvertisement | null
	eventRenderer: EventRenderer
	status: AdvertisementUpdateStatus

	constructor() {
		this.ad = null
		this.lastAd = null
		this.eventRenderer = new EventRenderer(config.server_event_lifetime)
		this.status = 'none'
	}

	isCompleted(): boolean {
		return this.ad != null && this.lastAd != null
	}

	tick(): void {
		this.eventRenderer.tick()
	}

	render(): void {
		let statusChar = colors.grey("-")
		if (this.status == 'error') {
			statusChar = colors.red("X")
		} else if (this.status == 'refresh') {
			statusChar = colors.white("!")
		}

		if (this.ad == null) {
			return
		}

		console.log(statusChar + colors.green(` ${this.ad.motd} `) + colors.bgBlue(`${this.ad.playersOnline}/${this.ad.playersMax}`) + colors.gray(` version: ${this.ad.version}`))
		this.eventRenderer.render()
	}
}

class ServerAdvertisementManager {
	ads: Map<number, ServerAdvertisementRenderer>

	constructor() {
		this.ads = new Map()
	}

	get(id: number): ServerAdvertisementRenderer {
		let adr = this.ads.get(id)
		if (adr == undefined) {
			adr = new ServerAdvertisementRenderer()
			this.ads.set(id, adr)
		}

		return adr
	}

	markRefreshing(id: number) {
		this.get(id).status = 'refresh'
	}

	markError(id: number): void {
		this.get(id).status = 'error'
	}

	set(id: number, ad: ServerAdvertisement) {
		this.get(id).status = 'none'

		let lastAd = this.get(id)

		if (lastAd == undefined) {
			throw Error("unexpected")
		}

		lastAd.lastAd = lastAd.ad
		lastAd.ad = ad

	}

	checkUpdates(): void {
		for (let vSet of this.ads) {
			let id = vSet[0]
			let adr = vSet[1]

			adr.tick()

			if (adr.ad == null || adr.lastAd == null) {
				continue
			}

			if (adr.status == 'error') {
				continue
			}

			let playerDiff = adr.ad.playersOnline - adr.lastAd.playersOnline

			if (Math.abs(playerDiff) > 0) {
				adr.eventRenderer.add(Event.player_diff(playerDiff))
			}
		}

	}

	render(): void {
		for (let vSet of this.ads) {
			let id = vSet[0]
			let ad = vSet[1]
			ad.render()

			console.log(colors.grey("\n--------------------------------"))
		}

	}
}

class ServerManager {
	renderer: ServerAdvertisementManager
	servers: Map<number, { host: string, port: number }>
	#next_id: number
	#interval: number
	eventRenderer: EventRenderer

	constructor(interval: number, eventRenderer: EventRenderer) {
		this.renderer = new ServerAdvertisementManager()
		this.servers = new Map()
		this.#next_id = 0
		this.#interval = interval
		this.eventRenderer = eventRenderer

		setInterval(async () => {
			await this.pingAll()
		}, interval)
	}

	getInterval(): number {
		return this.#interval
	}

	async pingAll() {
		for (let vSet of this.servers) {
			let id = vSet[0]
			let address = vSet[1]

			this.renderer.markRefreshing(id)
			await protocol.ping(address).then(res => {
				this.renderer.set(id, res)
			}).catch((reason) => {
				this.renderer.markError(id)
				this.eventRenderer.add(Event.ping_failure(address.host, address.port))
			})
		}

		this.renderer.checkUpdates();

		return Promise.resolve()
	}

	register(address: { host: string, port: number }): void {
		this.#next_id ++
		this.servers.set(this.#next_id, address)
	}
}

let globalEventRenderer = new EventRenderer(config.global_event_lifetime)
let adManager = new ServerManager(config.ping_rate, globalEventRenderer)

if (adManager.getInterval() < (1000 * 3)) {
	globalEventRenderer.add(new Event(colors.red("warning: ping interval under 3s.")))
}

for (let address of config.addresses) {
	adManager.register(address)
}

adManager.pingAll()

// rendering
setInterval(() => {
	console.clear()
	adManager.renderer.render()

	globalEventRenderer.tick()
	globalEventRenderer.render()
}, 1000 * (0.025))


