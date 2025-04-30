import { redis } from '../lib/redis.js'
import User from '../models/user.model.js'
import jwt from 'jsonwebtoken'

const generateToken=(userId)=>{
    const accessToken = jwt.sign({userId}, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '15m'
    })

    const refreshToken = jwt.sign({userId}, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d'
    })
    return {accessToken, refreshToken}
}
// const storeRefreshToken= async(userId, refreshToken)=>{
//     await redis.set(`refresh_token: ${userId}`, refreshToken, 'EX', 7*24*60*60)
// }
const storeRefreshToken = async (userId, refreshToken) => {
    try {
        const result = await redis.set(`refresh_token:${userId}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
        console.log('Token stored in Redis:', result); // Should log 'OK' on success
    } catch (error) {
        console.log('Error storing refresh token in Redis:', error);
    }
};


const setCookies=(res, accessToken, refreshToken)=>{
    res.cookie('accessToken', accessToken, {
        httpOnly: true, // prevents XSS attacks , cross site scripting attacks
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000*60*15, // 15 minutes
        sameSite: 'strict'// prevents CSRF attacks, cross-site request forgery
            });
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true, // prevents XSS attacks , cross site scripting attacks
        secure: process.env.NODE_ENV === 'production',
        maxAge:  7*24*60*60*1000, // 7 days
        sameSite: 'strict' // prevents CSRF attacks, cross-site request forgery
            });
        }

export const signup= async (req, res) => {
   try {
    const {email, password, name} = req.body 
    const userExists = await User.findOne({email});
    if (userExists) return res.status(400).json({message: 'Email already exists'});
    const user = await User.create({email, password, name});
    //authenticate user
     const {accessToken, refreshToken} =generateToken(user._id)
     await storeRefreshToken(user._id, refreshToken);
     setCookies(res, accessToken, refreshToken);

    // res.status(201).json({user, message: 'user created successfully' })// this will show user's evry information
    res.status(201).json({user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
    }, message: 'user created successfully' })// to hide the password
   } catch (error) {
    console.log("Error inlogging controller", error.message);
    res.status(500).json({message: error.message}); 
   }
}

export const login= async (req, res) => {
    try {
        const {email, password} = req.body;
        const user = await User.findOne({email})
        if (user && (await user.comparePassword(password))) {
           const {accessToken, refreshToken} = generateToken(user._id);
           await storeRefreshToken(user._id, refreshToken);
           setCookies(res, accessToken, refreshToken);
           res.json({
            _id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            message: 'Logged in successfully'
           })
        } else{
            res.status(400).json({message: 'Invalid Email or Password'})
        }
    } catch (error) {
        console.log("Error inlogging controller", error.message);
        res.status(500).json({message: error.message})
    }
}
export const logout= async (req, res) => {
   try {
    const refreshToken=req.cookies.refreshToken;
    if(refreshToken) {
        const decoded= jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        // await redis.del(`refresh_token: ${decoded.userId}`);
        
        const redisKey = `refresh_token:${decoded.userId}`; // No space
        console.log(`Deleting refresh token key: ${redisKey}`);
        await redis.del(redisKey); // Correct key

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        res.json({message: 'Logged out successfully'})
    }
   } catch (error) {
    console.log("Error inlogging controller", error.message);
    res.status(500).json({message: 'Server Error' ,error: error.message});
   }
}

export const refreshToken = async (req, res) => {
    try {
        const refreshToken= req.cookies.refreshToken;
        if(!refreshToken) return res.status(401).json({message: 'No refresh token provided'});

        const decoded= jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        console.log('Decoded token:', decoded); // Debugging log

        const storedToken= await redis.get(`refresh_token:${decoded.userId}`);
        console.log('Stored token:', storedToken); // Debugging log
        console.log('Provided refresh token:', refreshToken); // Debugging log

        if(storedToken!== refreshToken)
             return res.status(401).json({message: 'Invalid refresh token'});
        const accessToken = jwt.sign({userId: decoded.userId}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "15m"})
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000*60*15,
            sameSite: 'strict'
        })
        res.json({message: 'Token refreshed successfully'})
    } catch (error) {
        console.log("Error in refreshToken controller", error.message) 
        res.status(500).json({message: 'Server Error', error: error.message})  // 500 status for server error
    }
}

// TODO: implement getProfile later
export const getProfile = async (req, res) => {
    try {
        res.json(req.user)
    } catch (error) {
        res.status(500).json({message:'Server Error' ,error:error.message});
    }
}