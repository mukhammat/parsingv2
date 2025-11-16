import fs from 'fs'

export const log = (data: string) => {
    console.log(data)
    fs.writeFileSync('oils.log', data, {
        'flag':'a'
    })
}