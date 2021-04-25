import {
  API,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from "homebridge"
import { platformName, pluginName } from "./constants"
import { Api } from "./kiwi-api"
import { Sensor } from "./kiwi-api/api.interface"

function plugin(homebridge: API): void {
  homebridge.registerPlatform(pluginName, platformName, KiwiPlatform)
}

export class KiwiPlatform implements DynamicPlatformPlugin {
  public readonly PlatformAccessory = this.api.platformAccessory

  private readonly kiwiApi: Api
  private readonly pollingIntervalDuration: number
  private pollingInterval: NodeJS.Timer | null = null

  private accessories: PlatformAccessory[]

  public constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
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
      (a) => !this.accessories.map((a) => a.UUID).includes(a.UUID),
    )

    const accessoriesToRemove = this.accessories.filter(
      (a) => !newAccessories.map((a) => a.UUID).includes(a.UUID),
    )

    this.accessories = newAccessories

    accessoriesToAdd.forEach((a) => {
      this.log.info(`Add accessory: ${a.displayName}`)
      this.initAccesoryServices(a)
    })

    this.api.registerPlatformAccessories(
      pluginName,
      platformName,
      accessoriesToAdd,
    )

    accessoriesToRemove.forEach((a) =>
      this.log.info(`Remove accessory: ${a.displayName}`),
    )

    this.api.unregisterPlatformAccessories(
      pluginName,
      platformName,
      accessoriesToRemove,
    )
  }

  private createAccesoryFromSensor = (sensor: Sensor): PlatformAccessory => {
    const uuid = this.api.hap.uuid.generate(
      `${platformName}:${sensor.sensorId}`,
    )

    const accessory = new this.PlatformAccessory(
      sensor.customerName || sensor.name,
      uuid,
    )

    accessory.context.sensor = sensor

    return accessory
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.log.info(`Initialize accessory: ${accessory.displayName}`)

    this.initAccesoryServices(accessory)

    this.accessories.push(accessory)
  }

  getOrCreateSwitchService(accessory: PlatformAccessory): Service {
    return (
      accessory.getService(this.api.hap.Service.Switch) ||
      accessory.addService(this.api.hap.Service.Switch)
    )
  }

  private initAccesoryServices(accessory: PlatformAccessory): void {
    const sensor: Sensor = accessory.context.sensor

    const manufacturerService =
      accessory.getService(this.api.hap.Service.AccessoryInformation) ||
      accessory.addService(this.api.hap.Service.AccessoryInformation)

    manufacturerService
      .setCharacteristic(this.api.hap.Characteristic.Manufacturer, "Kiwi")
      .setCharacteristic(this.api.hap.Characteristic.Model, sensor.hardwareType)
      .setCharacteristic(
        this.api.hap.Characteristic.SerialNumber,
        String(sensor.sensorId),
      )

    const switchService = this.getOrCreateSwitchService(accessory)

    switchService.setCharacteristic(this.api.hap.Characteristic.On, false)

    switchService
      .getCharacteristic(this.api.hap.Characteristic.On)
      .on(CharacteristicEventTypes.SET, this.onSwitchServiceSet(accessory))
  }

  private onSwitchServiceSet(accessory: PlatformAccessory) {
    return async (
      state: CharacteristicValue,
      callback: CharacteristicSetCallback,
    ): Promise<void> => {
      const switchService = this.getOrCreateSwitchService(accessory)

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
          () =>
            switchService.setCharacteristic(
              this.api.hap.Characteristic.On,
              false,
            ),
          1000,
        ).unref()
      }
    }
  }
}

export default plugin
