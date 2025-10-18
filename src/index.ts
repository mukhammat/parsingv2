import 'dotenv/config'
import { api } from './api.js'

const main = async () => {
    try {
        await api()
    } catch (error) {
        if(error instanceof Error)
            console.log(error.message)
    }
}

main();