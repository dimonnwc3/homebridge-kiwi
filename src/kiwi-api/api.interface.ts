export interface Session {
  sessionKey: string
  enabled: string
  expires: string
  userId: number
  maxExpires: string
  username: string
  accountVerification: number
  language: string
}

export interface CreateSessionResponseBodyResult {
  sessionKey: string
  session: Session
}

export interface CreateSessionResponseBody {
  status: string
  result: CreateSessionResponseBodyResult
}

export enum HardwareType {
  UzHandleKiwiDoorHub = "UZ_HANDLE_KIWI_DOOR_HUB", // eslint-disable-line no-unused-vars
  UzKnobKiwiDoorIntegration = "UZ_KNOB_KIWI_DOOR_INTEGRATION", // eslint-disable-line no-unused-vars
}

export enum HighestPermission {
  IsHost = "IS_HOST", // eslint-disable-line no-unused-vars
}

export interface Owner {
  name: null
  userId: null
  lastname: null
  username: null
}
export interface Address {
  street: string
  postalCode: string
  city: string
  state: string
  country: string
  lat: number
  lng: number
  specifier: string
}

export interface Sensor {
  sensorId: number
  sensorName: null
  name: string
  customerName: null | string
  canInvite: boolean
  address: Address
  hardwareType: HardwareType
  hardwareVariant: null
  highestPermission: HighestPermission
  installationDate: string
  batteryStep: null
  owner: Owner
  isOwner: boolean
}
export interface GetSensorListResponseBodyResult {
  sensors: Sensor[]
  totalResults: number
  pageSize: number
  pageNumber: number
  orderBy: string
  sortBy: string
  customAttributes: any[]
}

export interface GetSensorListResponseBody {
  status: string
  result: GetSensorListResponseBodyResult
}

export interface OpenSensorResponseBody {
  status: string
}
