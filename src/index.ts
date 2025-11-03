import 'dotenv/config'
import { api } from './api.js'
import { AxiosError } from 'axios'
import { p } from './oils.js'

const main = async () => {
    try {
        await p()
        await api()
    } catch (error) {
        if(error instanceof Error) {
            if(error instanceof AxiosError) {
                console.log(JSON.stringify(error.response?.data))
            } else {
                console.log(error.message)
            }
        }
            
    }
}

main();