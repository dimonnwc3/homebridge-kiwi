import got, { AfterResponseHook, Got } from "got"
import humps from "humps"
import {
  CreateSessionResponseBody,
  GetSensorListResponseBody,
  OpenSensorResponseBody,
  Sensor,
  Session,
} from "./api.interface"

interface SessionKeyHeader {
  "session-key"?: string
}

interface GetSensorListResult {
  count: number
  sensors: Sensor[]
}

export class Api {
  private readonly username: string
  private readonly password: string
  private readonly http: Got
  private session: Session | null = null

  constructor(username: string, password: string) {
    this.username = username
    this.password = password

    const afterResponseHook: AfterResponseHook = async (
      response,
      retryWithMergedOptions,
    ) => {
      if (response.statusCode === 401) {
        await this.createSession()

        return retryWithMergedOptions({
          headers: {
            ...this.getSessionKeyHeader(),
          },
        })
      }

      return response
    }

    this.http = got.extend({
      prefixUrl: "https://api.kiwi.ki",
      mutableDefaults: true,
      hooks: {
        afterResponse: [afterResponseHook],
      },
    })
  }

  private getSessionKeyHeader(): SessionKeyHeader {
    const headers: SessionKeyHeader = {}

    if (this.session) {
      headers["session-key"] = this.session.sessionKey
    }

    return headers
  }

  public async createSession(): Promise<Session> {
    const res = await this.http<CreateSessionResponseBody>({
      method: "POST",
      url: "v1/session",
      responseType: "json",
      json: {
        username: this.username,
        password: this.password,
      },
    })

    res.body = humps.camelizeKeys(res.body) as CreateSessionResponseBody

    this.session = res.body.result.session

    return res.body.result.session
  }

  public async getSensorList(): Promise<GetSensorListResult> {
    const res = await this.http<GetSensorListResponseBody>({
      method: "GET",
      url: "v1/sensors",
      responseType: "json",
      headers: {
        ...this.getSessionKeyHeader(),
      },
    })

    res.body = humps.camelizeKeys(res.body) as GetSensorListResponseBody

    return {
      count: res.body.result.totalResults,
      sensors: res.body.result.sensors,
    }
  }

  public async openSensor(sensorId: number): Promise<OpenSensorResponseBody> {
    const res = await this.http<OpenSensorResponseBody>({
      method: "POST",
      url: `v1/sensors/${sensorId}/act/open`,
      responseType: "json",
      headers: {
        ...this.getSessionKeyHeader(),
      },
    })

    return res.body
  }
}
