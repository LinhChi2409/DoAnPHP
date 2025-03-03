import { AxiosResponse } from 'axios'
import { BadRequestFieldError, HttpResponse } from '../models/http'
import AxiosResponseData from '../models/axios'
import { setClearStateToLogout } from '../stores/mainSlice'
import { isEmptyObject } from '../utils/common'
import { removeLocalStorage } from '../utils/sessionStorage'
import axiosClient from './axios'

const setup = (store: any) => {
  axiosClient.interceptors.request.use(
    (config) => config,
    (error) => Promise.reject(error)
  )

  const { dispatch } = store

  axiosClient.interceptors.response.use(
    // @ts-expect-error: we want to return the different data type
    (response: AxiosResponse<AxiosResponseData>) => {
      const { status, data: responseData, headers } = response

      const data: HttpResponse<object> = {
        status,
        ok: true,
        body: responseData,
      }

      if (headers.link) {
        data.pagination = {
          total: Number(headers['x-total-count']),
        }
      }

      return data
    },
    ({ response }) => {
      const { status, data } = response as AxiosResponse<AxiosResponseData>
      const fieldErrors: BadRequestFieldError = {}

      if (data?.violations?.length) {
        data.violations.forEach(() => {
          const { field, message } = data.violations[0]

          if (fieldErrors[field]) {
            fieldErrors[field].push(message)
          } else {
            fieldErrors[field] = [message]
          }
        })
      }

      if (status === 401) {
        removeLocalStorage('access_token')
        removeLocalStorage('user')
        dispatch(setClearStateToLogout())
      }
      const error: HttpResponse = {
        status,
        ok: false,
        error: {
          unauthorized: status === 401,
          badRequest: status === 400,
          notFound: status === 404,
          clientError: status >= 400 && status <= 499,
          serverError: status >= 500 && status <= 599,
          message: data.detail,
          title: `${data.detail}-title`,
          fieldErrors: isEmptyObject(fieldErrors) ? undefined : fieldErrors,
          errors: data.errors,
        },
      }

      return Promise.reject(error)
    }
  )
}

export default setup
