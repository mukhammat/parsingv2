import 'dotenv/config'
import { api } from './api.js'
import { AxiosError } from 'axios'

const main = async () => {
    try {
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