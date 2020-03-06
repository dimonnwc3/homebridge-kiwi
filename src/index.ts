import { Api } from "./kiwi-api"
import { Sensor } from "./kiwi-api/api.interface"
import { Config } from "./config"
import { pluginName, platformName } from "./constants"

let Accessory: any
let Service: any
let Characteristic: any
let UUIDGen: any

function plugin(homebridge: any): void {
  Accessory = homebridge.platformAccessory

  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid

  homebridge.registerPlatform(pluginName, platformName, KiwiPlatform, true)
}

export class KiwiPlatform {
  private readonly kiwiApi: Api
  private readonly pollingIntervalDuration: number
  private pollingInterval: NodeJS.Timer | null = null

  private accessories: any[]

  private readonly api: any
  private readonly log: any

  public constructor(log: any, config: Config, api: any) {
    this.log = log
    this.api = api
    this.accessories = []
    this.pollingIntervalDuration = config.interval || 600000

    this.kiwiApi = new Api(config.username, config.password)

    this.api.on("didFinishLaunching", () => this.startPolling())

    this.api.on("shutdown", () => this.stopPolling())
  }

  private startPolling(): void {
    if (this.pollingInterval) return

    this.tick()

    this.pollingInterval = setInterval(
      this.tick,
      this.pollingIntervalDuration,
    ).unref()
  }

  private stopPolling(): void {
    if (!this.pollingInterval) return

    clearInterval(this.pollingInterval)
    this.pollingInterval = null
  }

  private readonly tick = async (): Promise<void> => {
    try {
      await this.refreshSensors()
    } catch (err) {
      this.log.error(err.message)
    }
  }

  private async refreshSensors(): Promise<void> {
    const { sensors } = await this.kiwiApi.getSensorList()

    const newAccessories = sensors.map(this.createAccesoryFromSensor)

    const accessoriesToAdd = newAccessories.filter(
      a => !this.accessories.map(a => a.UUID).includes(a.UUID),
    )

    const accessoriesToRemove = this.accessories.filter(
      a => !newAccessories.map(a => a.UUID).includes(a.UUID),
    )

    this.accessories = newAccessories

    accessoriesToAdd.forEach(a => {
      this.log(`Add accessory: ${a.displayName}`)
      this.initAccesoryServices(a)
    })

    this.api.registerPlatformAccessories(
      pluginName,
      platformName,
      accessoriesToAdd,
    )

    accessoriesToRemove.forEach(a =>
      this.log(`Remove accessory: ${a.displayName}`),
    )

    this.api.unregisterPlatformAccessories(
      pluginName,
      platformName,
      accessoriesToRemove,
    )
  }

  private createAccesoryFromSensor(sensor: Sensor): any {
    const uuid = UUIDGen.generate(`${platformName}:${sensor.sensorId}`)

    const accessory = new Accessory(sensor.customerName || sensor.name, uuid)

    accessory.context.sensor = sensor

    return accessory
  }

  public configureAccessory(accessory: any): void {
    this.log(`Initialize accessory: ${accessory.displayName}`)

    this.initAccesoryServices(accessory)

    this.accessories.push(accessory)
  }

  private initAccesoryServices(accessory: any): void {
    const sensor: Sensor = accessory.context.sensor

    const manufacturerService = accessory.getService(
      Service.AccessoryInformation,
    )

    manufacturerService
      .setCharacteristic(Characteristic.Manufacturer, "Kiwi")
      .setCharacteristic(Characteristic.Model, sensor.hardwareType)
      .setCharacteristic(Characteristic.SerialNumber, sensor.sensorId)

    const switchService =
      accessory.getService(Service.Switch) ||
      accessory.addService(Service.Switch)

    switchService.setCharacteristic(Characteristic.On, false)

    switchService
      .getCharacteristic(Characteristic.On)
      .on("set", this.onSwitchServiceSet(accessory))
  }

  private onSwitchServiceSet(accessory: any) {
    return async (
      state: boolean,
      callback: (err?: Error | null) => void,
    ): Promise<void> => {
      const switchService = accessory.getService(Service.Switch)
      const sensor: Sensor = accessory.context.sensor

      if (!state) {
        return callback()
      }

      this.log.debug(`Sending open request to Kiwi sensor: ${sensor.sensorId}`)

      try {
        await this.kiwiApi.openSensor(sensor.sensorId)
        callback()
      } catch (err) {
        this.log.error(err.message)
        callback(err)
      } finally {
        setTimeout(
          () => switchService.setCharacteristic(Characteristic.On, false),
          1000,
        ).unref()
      }
    }
  }
}

export default plugin
