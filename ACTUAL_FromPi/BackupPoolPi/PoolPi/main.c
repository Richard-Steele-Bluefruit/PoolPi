#include "v4l2_driver.h"
#include <SDL2/SDL.h>
#include <SDL2/SDL_image.h>
#include <linux/videodev2.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <fcntl.h>
#include <time.h>
#include <unistd.h>
#include <sys/wait.h>

#define SAVE_EVERY_FRAME 0

pthread_t thread_stream;
SDL_Window *sdlScreen = NULL;
SDL_Renderer *sdlRenderer = NULL;
SDL_Texture *sdlTexture = NULL;
SDL_Rect sdlRect;

SDL_Surface *videoSurface = NULL;
SDL_Texture *buttonTexture = NULL;
SDL_Rect buttonPosition;

int showRecordButton = 1;

static volatile sig_atomic_t ffmpegPid = 0;

int thread_exit_sig = 0;

struct streamHandler
{
    int fd;
    void (*framehandler)(void *pframe, int length);
};

typedef struct circularBuffer
{
    void *buffer;
    void *bufferEnd;
    void *head;
    void *tail;
    size_t capacity;
    size_t count;
    size_t size;
} circularBuffer;

circularBuffer savedFrames;

void circularBufferInit(circularBuffer *cb, size_t capacity, size_t size)
{
    cb->buffer = malloc(capacity * size);
    cb->bufferEnd = (char *)cb->buffer + capacity * size;
    cb->head = cb->buffer;
    cb->tail = cb->buffer;
    cb->capacity = capacity;
    cb->count = 0;
    cb->size = size;
}

void circularBufferFree(circularBuffer *cb)
{
    free(cb->buffer);
}

void circularBufferAddItem(circularBuffer *cb, const void *item)
{
    memcpy(cb->head, item, cb->size);

    cb->head = (char*)cb->head + cb->size;

    if(cb->head == cb->bufferEnd)
    {
        cb->head = cb->buffer;
    }

    if (cb->count++ >= cb->capacity)
    {
        cb->count = cb->capacity;
    }
}

static void frame_handler(void *pframe, int length)
{
    SDL_UpdateTexture(sdlTexture, &sdlRect, pframe, IMAGE_WIDTH * 2);
    //videoSurface = SDL_CreateRGBSurfaceWithFormat(0, IMAGE_WIDTH, IMAGE_HEIGHT, 32, SDL_PIXELFORMAT_IYUV);
    //sdlTexture = SDL_CreateTextureFromSurface(sdlRenderer, videoSurface);
    //  SDL_UpdateYUVTexture
    SDL_RenderClear(sdlRenderer);
    SDL_RenderCopy(sdlRenderer, sdlTexture, NULL, &sdlRect);
    if (showRecordButton)
    {
        SDL_RenderCopy(sdlRenderer, buttonTexture, NULL, &buttonPosition);
    }
    SDL_RenderPresent(sdlRenderer);

    //circularBufferAddItem(&savedFrames, pframe);

#if SAVE_EVERY_FRAME
    static int yuv_index = 0;
    char yuvifle[100];
    sprintf(yuvifle, "Frames/yuv-%d.yuv", yuv_index);
    FILE *fp = fopen(yuvifle, "wb");
    fwrite(pframe, length, 1, fp);
    fclose(fp);
    yuv_index = (yuv_index+1) % 150;
#endif
}

static void *v4l2_streaming(void *arg)
{
    memset(&sdlRect, 0, sizeof(sdlRect));
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER))
    {
        printf("Could not initialize SDL - %s\n", SDL_GetError());
        return NULL;
    }

    sdlScreen = SDL_CreateWindow("PoolPi",
                                0, 0,
                                IMAGE_WIDTH, IMAGE_HEIGHT,
                                SDL_WINDOW_SHOWN | SDL_WINDOW_FULLSCREEN | SDL_WINDOW_BORDERLESS | SDL_WINDOW_OPENGL);

    if (!sdlScreen)
    {
        fprintf(stderr, "SDL: could not create window - exiting:%s\n", SDL_GetError());
        return NULL;
    }

    sdlRenderer = SDL_CreateRenderer(sdlScreen, -1, SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    if (sdlRenderer == NULL)
    {
        fprintf(stderr, "SDL_CreateRenderer Error\n");
        return NULL;
    }
    sdlTexture = SDL_CreateTexture(sdlRenderer, SDL_PIXELFORMAT_YUY2, SDL_TEXTUREACCESS_STREAMING, IMAGE_WIDTH, IMAGE_HEIGHT);
    sdlRect.w = IMAGE_WIDTH;
    sdlRect.h = IMAGE_HEIGHT;
    
    buttonPosition.w = 120;
    buttonPosition.h = 60;
    buttonPosition.x = IMAGE_WIDTH - buttonPosition.w - 10;
    buttonPosition.y = 10;
    
    buttonTexture = IMG_LoadTexture(sdlRenderer, "/home/pi/PoolPi2/PoolPi/recButtonImage.png");

    int fd = ((struct streamHandler *)(arg))->fd;
    void (*handler)(void *pframe, int length) = ((struct streamHandler *)(arg))->framehandler;

    fd_set fds;
    struct v4l2_buffer buf;
    while (!thread_exit_sig)
    {
        int ret;
        FD_ZERO(&fds);
        FD_SET(fd, &fds);
        struct timeval tv = {.tv_sec = 4, .tv_usec = 0};
        ret = select(fd + 1, &fds, NULL, NULL, &tv);
        if (-1 == ret)
        {
            fprintf(stderr, "select error\n");
            return NULL;
        }
        else if (0 == ret)
        {
            fprintf(stderr, "timeout waiting for frame\n");
            continue;
        }
        if (FD_ISSET(fd, &fds))
        {
            memset(&buf, 0, sizeof(buf));
            buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            buf.memory = V4L2_MEMORY_MMAP;
            

            if (-1 == ioctl(fd, VIDIOC_DQBUF, &buf))
            {
                fprintf(stderr, "VIDIOC_DQBUF failure\n");
                return NULL;
            }
#ifdef DEBUG
            printf("deque buffer %d\n", buf.index);
#endif

            circularBufferAddItem(&savedFrames, v4l2_ubuffers[buf.index].start);
    
            if (handler)
            {
                (*handler)(v4l2_ubuffers[buf.index].start, v4l2_ubuffers[buf.index].length);
            }
            buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
            buf.memory = V4L2_MEMORY_MMAP;
            if (-1 == ioctl(fd, VIDIOC_QBUF, &buf))
            {
                fprintf(stderr, "VIDIOC_QBUF failure\n");
                return NULL;
            }
#ifdef DEBUG
            printf("queue buffer %d\n", buf.index);
#endif
        }
    }
    printf("thread_exit_sig == 0\n");
    return NULL;
}

int main(int argc, char const *argv[])
{
    IMAGE_WIDTH = 800;
    IMAGE_HEIGHT = 448;

    circularBufferInit(&savedFrames, 4 * 15, IMAGE_WIDTH * IMAGE_HEIGHT * 2);

    const char *device = "/dev/video0";

    int video_fildes = v4l2_open(device);
    if (video_fildes == -1)
    {
        fprintf(stderr, "can't open %s\n", device);
        exit(-1);
    }

    if (v4l2_querycap(video_fildes, device) == -1)
    {
        perror("v4l2_querycap");
        goto exit_;
    }

    // most of devices support YUYV422 packed.
    if (v4l2_sfmt(video_fildes, V4L2_PIX_FMT_YUYV) == -1)
    {
        perror("v4l2_sfmt");
        goto exit_;
    }

    if (v4l2_gfmt(video_fildes) == -1)
    {
        perror("v4l2_gfmt");
        goto exit_;
    }

    if (v4l2_sfps(video_fildes, 25) == -1)
    { // no fatal error
        perror("v4l2_sfps");
    }

    if (v4l2_mmap(video_fildes) == -1)
    {
        perror("v4l2_mmap");
        goto exit_;
    }

    if (v4l2_streamon(video_fildes) == -1)
    {
        perror("v4l2_streamon");
        goto exit_;
    }

    // create a thread that will update frame int the buffer
    struct streamHandler sH = {video_fildes, frame_handler};
    if (pthread_create(&thread_stream, NULL, v4l2_streaming, (void *)(&sH)))
    {
        fprintf(stderr, "create thread failed\n");
        goto exit_;
    }

    int quit = 0;
    int x, y;
    SDL_Event e;
    while (!quit)
    {
        while (SDL_PollEvent(&e))
        {
            switch (e.type)
            {
            case SDL_QUIT:
                quit = 1;
                break;
                
            case SDL_KEYDOWN:
                if (e.key.keysym.sym == SDLK_ESCAPE)
                {
                    quit = 1;
                }
                break;
            
            case SDL_FINGERDOWN:
                
                x = e.tfinger.x;
                y = e.tfinger.y;
                
                if (x >= buttonPosition.x && y <= buttonPosition.h+10)
                {
                    showRecordButton = 0;
                
                    //system("cat /home/pi/PoolPi2/PoolPi/Frames/*.yuv > /home/pi/PoolPi2/PoolPi/Frames/all.yuv");

                    FILE *yuvFile = fopen("/home/pi/PoolPi2/PoolPi/Frames/frameData.yuv", "wb");
                    
                    int i;
                    for (i = 0; i < savedFrames.capacity; i++)
                    {
                        void* frameData = (savedFrames.buffer + ((savedFrames.head - savedFrames.buffer + i * savedFrames.size) % (savedFrames.capacity * savedFrames.size)));
                        fwrite(frameData, savedFrames.size, 1, yuvFile);
                    }
                    
                    fclose(yuvFile);

                    ffmpegPid = (sig_atomic_t)fork();
                    
                    if (ffmpegPid == 0)
                    {
                        int strLength;
                        char *fileStr;
                        
                        //Redirect output of ffmpeg to the bit bucket
                  //      int fd = open("/dev/null", O_WRONLY);
                  //      dup2(fd, 1);
                  //      dup2(fd, 2);
                  //      close(fd);
                        
                        //Build filename as date in milliseconds
                        struct timeval tv;
                        gettimeofday(&tv, NULL);
                        strLength = snprintf(NULL, 0, "/var/www/html/vids/%ld%03ld.mp4", tv.tv_sec, tv.tv_usec / 1000) + 1;
                        fileStr = malloc(strLength);
                        snprintf(fileStr, strLength, "/var/www/html/vids/%ld%03ld.mp4", tv.tv_sec, tv.tv_usec / 1000);

                    //    execl("/usr/local/bin/ffmpeg", "ffmpeg", "-y", "-i", "/dev/video0", "-c:v", "h264_omx", "-b:v", "5M", fileStr, (char *)NULL);
                        
                        execl("/usr/local/bin/ffmpeg", "ffmpeg", "-t", "00:00:12.00", "-framerate", "4", "-video_size", "800x448", "-pix_fmt", "yuyv422", "-y", "-i", "/home/pi/PoolPi2/PoolPi/Frames/frameData.yuv", "-c:v", "h264_omx", "-framerate", "4", "-t", "00:00:12.00", fileStr, (char *)NULL);
                    }
                    
                    //kill((pid_t)ffmpegPid, SIGINT);
                    //waitpid((pid_t)ffmpegPid, NULL, 0);
                    
                    showRecordButton = 1;
                    printf("Foobar\n");
                }
                break;
            }
        }
        usleep(25);
    }

    thread_exit_sig = 1;               // exit thread_stream
    pthread_join(thread_stream, NULL); // wait for thread_stream exiting

    if (v4l2_streamoff(video_fildes) == -1)
    {
        perror("v4l2_streamoff");
        goto exit_;
    }

    if (v4l2_munmap() == -1)
    {
        perror("v4l2_munmap");
        goto exit_;
    }

exit_:
    if (v4l2_close(video_fildes) == -1)
    {
        perror("v4l2_close");
    };
    SDL_Quit();

    printf("Successfully exited\n");
    return 0;
}
